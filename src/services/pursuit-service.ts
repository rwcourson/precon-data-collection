import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  customColumnValues,
  customColumns,
  estimateRounds,
  jobs,
  notifications,
  roundMultiValues,
  statusTransitions,
  users,
  type RoundStatus,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import {
  loadJobForPrincipal,
  loadRoundForPrincipal,
} from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import { authorize } from "@/lib/authorization/kernel";
import { MULTI_FIELD_KEYS, ROUND_COLUMN_KEYS } from "@/lib/fields";
import { connectProvider } from "@/lib/integrations/connect";
import { deliverQueued, queueEmails } from "@/lib/email";
import { planOutcomeUpdate, type OutcomeValue } from "@/lib/outcome";
import { allowedTransitions } from "@/lib/authorization/lifecycle";
import { STATUS_LABELS } from "@/lib/labels";
import { getMultiValues, getReferenceValues, getRoundWithJob } from "@/lib/queries";
import { getNotificationSettings } from "@/lib/reminders";
import { planSalesforceLink } from "@/lib/salesforce-link";
import { evaluateLockGate, validateFieldValue } from "@/lib/validation";
import { findDuplicateJobs, type DuplicateMatch } from "@/lib/duplicate-jobs";
import { resolveCreatorHomeRegion } from "@/lib/home-region";
import {
  assertPrincipalCanCreatePursuit,
  requireAuthorized,
} from "@/services/mutation-policy";
import { recordHomeRegionVisibility } from "@/services/visibility-service";
import {
  transactionFault,
  updateRoundIfUnchanged,
  withTransaction,
} from "@/lib/transactions";

export type CreatePursuitInput = {
  mode: "salesforce" | "manual";
  sfId?: string;
  jobName?: string;
  region: string;
  preconDepartment: string;
  estimatePhase: string;
  bidYear: number;
  bidDueDate?: string;
  city?: string;
  state?: string;
  marketSector?: string;
  mlt?: string;
  contractType?: string;
  procurement?: string;
  statusAtPricing?: string;
  initialStatus: "active" | "upcoming" | "outstanding";
  /** Skip the duplicate warning and create anyway. */
  confirmDuplicate?: boolean;
};

export type CreatePursuitCreated = { kind: "created"; jobId: number; roundId: number };
export type CreatePursuitDuplicates = { kind: "duplicates"; matches: DuplicateMatch[] };
export type CreatePursuitResult = CreatePursuitCreated | CreatePursuitDuplicates;

export function requireCreatedPursuit(result: CreatePursuitResult): CreatePursuitCreated {
  if (result.kind !== "created") {
    throw new Error(`Expected a created pursuit, received ${result.matches.length} duplicate match(es).`);
  }
  return result;
}

export type AddRoundInput = {
  jobId: number;
  estimatePhase: string;
  bidYear: number;
  bidDueDate?: string;
  initialStatus: "active" | "upcoming" | "outstanding";
};

export type SavePostBidInput = {
  roundId: number;
  values: Record<string, string>;
  multiValues: Record<string, string[]>;
  customValues: Record<number, string>;
  estimateLeadId?: number | null;
  /**
   * Optimistic-concurrency snapshot: the round's updatedAt as rendered by the
   * client. When present, a save fails with a conflict if anyone else edited
   * the round in between. Omitted → falls back to a fresh read (legacy).
   */
  expectedUpdatedAt?: string | Date | null;
};

/** Unique-constraint violation (Postgres 23505 / PGlite message), possibly wrapped. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current != null; depth++) {
    if (typeof current === "object") {
      const e = current as { code?: unknown; message?: unknown; cause?: unknown };
      if (e.code === "23505") return true;
      if (typeof e.message === "string" && /duplicate key value|unique constraint/i.test(e.message)) {
        return true;
      }
      current = e.cause;
    } else {
      break;
    }
  }
  return false;
}

/** Placeholder job number for manual pursuits, checked against existing jobs. */
async function generateTbdJobNumber(): Promise<string> {
  // Widen the random space each retry so a crowded TBD range cannot collide forever.
  for (let attempt = 0; attempt < 5; attempt++) {
    const span = 9000 * 10 ** attempt;
    const candidate = `TBD-${1000 + Math.floor(Math.random() * span)}`;
    const [existing] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.jobNumber, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `TBD-${Date.now()}`;
}

/** Transport-neutral pursuit mutations — caller supplies an explicit principal. */
export const pursuitService = {
  async createPursuit(principal: Principal, input: CreatePursuitInput): Promise<CreatePursuitResult> {
    const homeRegion = resolveCreatorHomeRegion(principal, input.region);
    assertPrincipalCanCreatePursuit(principal, homeRegion);
    const user = principal.user;

    let jobNumber: string;
    let jobName: string;
    let salesforceId: string | null = null;
    let isLinked = false;
    let city = input.city ?? null;
    let state = input.state ?? null;
    let marketSector = input.marketSector ?? null;

    if (input.mode === "salesforce") {
      const sf = await connectProvider().getById(input.sfId ?? "");
      if (!sf) throw DomainError.notFound("Salesforce job not found");
      jobNumber = sf.jobNumber;
      jobName = sf.jobName;
      salesforceId = sf.sfId;
      isLinked = true;
      city = city ?? sf.city;
      state = state ?? sf.state;
      marketSector = marketSector ?? sf.marketSector;
    } else {
      if (!input.jobName?.trim()) throw DomainError.badRequest("Job Name is required for manual pursuits");
      jobName = input.jobName.trim();
      jobNumber = await generateTbdJobNumber();
    }

    if (!input.confirmDuplicate) {
      const existingRows = await db
        .select({
          jobId: jobs.id,
          jobName: jobs.jobName,
          jobNumber: jobs.jobNumber,
          homeRegion: jobs.region,
          creatorName: users.name,
          city: estimateRounds.city,
          state: estimateRounds.state,
          owner: estimateRounds.owner,
          lastActivityAt: estimateRounds.updatedAt,
        })
        .from(jobs)
        .leftJoin(users, eq(jobs.createdById, users.id))
        .leftJoin(estimateRounds, and(eq(estimateRounds.jobId, jobs.id), isNull(estimateRounds.deletedAt)))
        .where(isNull(jobs.deletedAt));
      const latest = new Map<number, (typeof existingRows)[number]>();
      for (const row of existingRows) {
        const prev = latest.get(row.jobId);
        if (!prev) {
          latest.set(row.jobId, row);
          continue;
        }
        const prevAt = prev.lastActivityAt ? new Date(prev.lastActivityAt).getTime() : 0;
        const nextAt = row.lastActivityAt ? new Date(row.lastActivityAt).getTime() : 0;
        if (nextAt >= prevAt) latest.set(row.jobId, row);
      }
      const matches = findDuplicateJobs(
        { jobName, city, state, owner: null },
        [...latest.values()],
      );
      if (matches.length > 0) return { kind: "duplicates", matches };
    }

    return withTransaction(async (tx) => {
      const [job] = await tx
        .insert(jobs)
        .values({
          jobNumber,
          jobName,
          region: homeRegion,
          preconDepartment: input.preconDepartment,
          salesforceId,
          isLinked,
          createdById: user.id,
        })
        .returning();

      await recordHomeRegionVisibility(tx, job);

      const [round] = await tx
        .insert(estimateRounds)
        .values({
          jobId: job.id,
          roundNumber: 1,
          status: input.initialStatus,
          region: homeRegion,
          preconDepartment: input.preconDepartment,
          estimatePhase: input.estimatePhase,
          bidYear: input.bidYear,
          bidDueDate: input.bidDueDate || null,
          city,
          state,
          marketSector,
          mlt: input.mlt || null,
          contractType: input.contractType || null,
          procurement: input.procurement || null,
          statusAtPricing: input.statusAtPricing || null,
          createdById: user.id,
        })
        .returning();

      await tx.insert(statusTransitions).values({
        roundId: round.id,
        fromStatus: null,
        toStatus: input.initialStatus,
        userId: user.id,
      });

      return { kind: "created" as const, jobId: job.id, roundId: round.id };
    });
  },

  async addEstimateRound(principal: Principal, input: AddRoundInput) {
    const loaded = await loadJobForPrincipal(principal, input.jobId, "edit");
    if (!loaded) throw DomainError.notFound("Job not found");
    const job = loaded.value;
    const user = principal.user;

    // Concurrent adds can both read the same max(roundNumber); the unique index
    // on (job_id, round_number) rejects the loser, which retries with a re-read.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await withTransaction(async (tx) => {
          const existing = await tx
            .select({ n: estimateRounds.roundNumber, r: estimateRounds })
            .from(estimateRounds)
            .where(eq(estimateRounds.jobId, job.id));
          const maxRound = Math.max(0, ...existing.map((e) => e.n));
          const latest = existing.sort((a, b) => b.n - a.n)[0]?.r;

          const [round] = await tx
            .insert(estimateRounds)
            .values({
              jobId: job.id,
              roundNumber: maxRound + 1,
              status: input.initialStatus,
              region: job.region,
              preconDepartment: job.preconDepartment,
              estimatePhase: input.estimatePhase,
              bidYear: input.bidYear,
              bidDueDate: input.bidDueDate || null,
              city: latest?.city ?? null,
              state: latest?.state ?? null,
              marketSector: latest?.marketSector ?? null,
              mlt: latest?.mlt ?? null,
              contractType: latest?.contractType ?? null,
              procurement: latest?.procurement ?? null,
              owner: latest?.owner ?? null,
              drawingsDueDate: latest?.drawingsDueDate ?? null,
              bidReviewDate: latest?.bidReviewDate ?? null,
              estimateLeadId: latest?.estimateLeadId ?? null,
              createdById: user.id,
            })
            .returning();

          await tx.insert(statusTransitions).values({
            roundId: round.id,
            fromStatus: null,
            toStatus: input.initialStatus,
            userId: user.id,
          });

          return { roundId: round.id, jobId: job.id };
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  },

  async transitionStatus(principal: Principal, roundId: number, to: RoundStatus) {
    const loaded = await loadRoundForPrincipal(principal, roundId, { capability: "edit" });
    if (!loaded) throw DomainError.notFound("Round not found");
    const round = loaded.value.round;
    const user = principal.user;

    // Locking must go through Approve & Lock, which enforces the required-field
    // gate and stamps lockedAt. The generic transition path would bypass both.
    if (to === "locked") {
      throw DomainError.badRequest(
        "Rounds cannot be locked through a direct status change.",
        "Locking requires the required-field gate.",
        "Use the Approve & Lock flow instead.",
      );
    }

    const allowed = allowedTransitions(principal, round);
    if (!allowed.includes(to)) {
      throw DomainError.forbidden(
        `${user.name} cannot move this round from ${STATUS_LABELS[round.status]} to ${STATUS_LABELS[to]}`,
      );
    }

    // Inside the transaction we only write DB rows (using the tx handle — the
    // prod pool is max:1, so global-db calls in here would self-deadlock).
    // Email delivery (network) happens after commit.
    const queuedEmailIds = await withTransaction(async (tx) => {
      const patch: Partial<typeof estimateRounds.$inferInsert> = {
        status: to,
      };
      if (to === "submitted") patch.submittedAt = new Date();
      await updateRoundIfUnchanged(tx, {
        roundId,
        expectedStatus: round.status,
        expectedUpdatedAt: round.updatedAt,
        patch,
      });
      await tx.insert(statusTransitions).values({
        roundId,
        fromStatus: round.status,
        toStatus: to,
        userId: user.id,
      });

      let emailIds: number[] = [];
      if (to === "submitted") {
        const [job] = await tx.select().from(jobs).where(eq(jobs.id, round.jobId));
        const targetId =
          round.estimateLeadId ??
          (await tx.select().from(users).where(eq(users.role, "estimate_lead")))[0]?.id;
        if (targetId) {
          const title = `Post-bid data needed: ${job?.jobName ?? "Pursuit"}`;
          const body = `${round.estimatePhase} (Bid Year ${round.bidYear}) moved to Submitted. Complete the remaining post-bid fields.`;
          const settings = await getNotificationSettings(tx);
          if (settings.inApp) {
            await tx.insert(notifications).values({ userId: targetId, title, body, roundId });
          }
          if (settings.email) {
            const [target] = await tx.select().from(users).where(eq(users.id, targetId));
            if (target?.email) {
              emailIds = await queueEmails(
                [
                  {
                    toEmail: target.email,
                    toUserId: target.id,
                    subject: title,
                    body: `${body}\n\nOpen the round to finish entry: /rounds/${roundId}`,
                    kind: "submitted",
                    roundId,
                  },
                ],
                tx,
              );
            }
          }
        }
      }
      return emailIds;
    });

    // The outbox rows are committed with the status change; delivery is a
    // network call and stays outside the transaction. Failures are retried by
    // the outbox sweep, so they must not fail the transition itself.
    if (queuedEmailIds.length > 0) {
      try {
        await deliverQueued(queuedEmailIds);
      } catch (error) {
        console.error("Post-transition email delivery failed; outbox will retry.", error);
      }
    }

    return { roundId, status: to };
  },

  async assignEstimateLead(principal: Principal, roundId: number, userId: number | null) {
    await requireRoundFieldWrite(principal, roundId, "estimateLead");
    await db
      .update(estimateRounds)
      .set({ estimateLeadId: userId, updatedAt: new Date() })
      .where(eq(estimateRounds.id, roundId));
    return { roundId, estimateLeadId: userId };
  },

  async linkJobToSalesforce(principal: Principal, jobId: number, sfId: string) {
    const loaded = await loadJobForPrincipal(principal, jobId, "edit");
    if (!loaded) throw DomainError.notFound("Job not found");
    const job = loaded.value;
    const user = principal.user;

    const sf = await connectProvider().getById(sfId);
    const existingRounds = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .where(eq(estimateRounds.jobId, jobId));

    const plan = planSalesforceLink(
      job,
      sf,
      existingRounds.map((r) => r.id),
    );

    await db.update(jobs).set(plan.patch).where(eq(jobs.id, plan.jobId));
    await db.insert(auditLog).values({
      entity: plan.audit.entity,
      entityId: plan.jobId,
      action: plan.audit.action,
      field: plan.audit.field,
      oldValue: plan.audit.oldValue,
      newValue: plan.audit.newValue,
      userId: user.id,
    });

    return {
      jobId: plan.jobId,
      preservedRoundIds: plan.preservedRoundIds,
    };
  },

  async savePostBidData(principal: Principal, input: SavePostBidInput) {
    const user = principal.user;
    const loaded = await loadRoundForPrincipal(principal, input.roundId);
    if (!loaded) throw DomainError.notFound("Round not found");
    const round = loaded.value.round;
    const locked = round.status === "locked";

    // Prefer the snapshot the client rendered with; the fresh read below would
    // make the optimistic guard vacuous (it always matches itself).
    const clientSnapshot =
      input.expectedUpdatedAt != null ? new Date(input.expectedUpdatedAt) : null;
    const expectedUpdatedAt =
      clientSnapshot && !Number.isNaN(clientSnapshot.getTime())
        ? clientSnapshot
        : round.updatedAt;

    const [lists, existingMulti] = await Promise.all([
      getReferenceValues(),
      getMultiValues(round.id),
    ]);
    const patch: Record<string, unknown> = {};
    const auditRows: (typeof auditLog.$inferInsert)[] = [];
    const changedFields: string[] = [];

    for (const [key, raw] of Object.entries(input.values)) {
      if (!ROUND_COLUMN_KEYS.includes(key)) continue;
      const oldValue = (round as unknown as Record<string, unknown>)[key];
      // Full-form submits include every field. Do not fail a correction because an
      // imported dropdown value is still off the current managed list.
      if (String(oldValue ?? "") === String(raw ?? "")) continue;
      const result = validateFieldValue(key, raw, lists);
      if (!result.ok) throw DomainError.badRequest(result.error);
      const newValue = result.value;
      const changed =
        (oldValue ?? null) !== (newValue ?? null) &&
        String(oldValue ?? "") !== String(newValue ?? "");
      if (changed) {
        patch[key] = newValue;
        changedFields.push(key);
        if (locked) {
          auditRows.push({
            entity: "round",
            entityId: round.id,
            roundId: round.id,
            action: "post_lock_edit",
            field: key,
            oldValue: oldValue == null ? null : String(oldValue),
            newValue: newValue == null ? null : String(newValue),
            userId: user.id,
          });
        }
      }
    }

    if (input.estimateLeadId !== undefined && input.estimateLeadId !== round.estimateLeadId) {
      patch.estimateLeadId = input.estimateLeadId;
      changedFields.push("estimateLead");
      if (locked) {
        auditRows.push({
          entity: "round",
          entityId: round.id,
          roundId: round.id,
          action: "post_lock_edit",
          field: "estimateLead",
          oldValue: String(round.estimateLeadId ?? ""),
          newValue: String(input.estimateLeadId ?? ""),
          userId: user.id,
        });
      }
    }

    const multiChanges: { key: string; previous: string[]; next: string[] }[] = [];
    for (const key of MULTI_FIELD_KEYS) {
      if (!(key in input.multiValues)) continue;
      const next = [...new Set(input.multiValues[key])];
      const previous = existingMulti[key] ?? [];
      if (JSON.stringify([...previous].sort()) === JSON.stringify([...next].sort())) continue;
      multiChanges.push({ key, previous, next });
      changedFields.push(key);
      if (locked) {
        auditRows.push({
          entity: "round",
          entityId: round.id,
          roundId: round.id,
          action: "post_lock_edit",
          field: key,
          oldValue: previous.join(", "),
          newValue: next.join(", "),
          userId: user.id,
        });
      }
    }

    const customChanges: {
      columnId: number;
      existingId: number | null;
      previous: string;
      next: string;
    }[] = [];
    const colIds = Object.keys(input.customValues).map(Number);
    if (colIds.length > 0) {
      const cols = await db.select().from(customColumns).where(inArray(customColumns.id, colIds));
      for (const col of cols) {
        const raw = input.customValues[col.id] ?? "";
        const [existing] = await db
          .select()
          .from(customColumnValues)
          .where(
            and(eq(customColumnValues.columnId, col.id), eq(customColumnValues.roundId, round.id)),
          );
        const previous = existing?.value ?? "";
        if (previous === raw || (!existing && !raw)) continue;
        customChanges.push({
          columnId: col.id,
          existingId: existing?.id ?? null,
          previous,
          next: raw,
        });
        changedFields.push(`custom:${col.id}`);
        if (locked) {
          auditRows.push({
            entity: "round",
            entityId: round.id,
            roundId: round.id,
            action: "post_lock_edit",
            field: `custom:${col.id}`,
            oldValue: previous,
            newValue: raw,
            userId: user.id,
          });
        }
      }
    }

    for (const key of new Set(changedFields)) {
      await requireRoundFieldWrite(principal, input.roundId, key);
    }

    await withTransaction(async (tx) => {
      if (changedFields.length > 0) {
        const { appendEntityVersion } = await import("@/lib/recovery");
        await appendEntityVersion("round", round.id, { ...round }, user.id, tx);
      }
      if (Object.keys(patch).length > 0 || multiChanges.length > 0 || customChanges.length > 0) {
        await updateRoundIfUnchanged(tx, {
          roundId: round.id,
          expectedStatus: round.status,
          expectedUpdatedAt,
          patch: Object.keys(patch).length > 0 ? patch : {},
        });
      }
      transactionFault.maybeThrow("after-round-update");
      for (const change of multiChanges) {
        await tx
          .delete(roundMultiValues)
          .where(
            and(eq(roundMultiValues.roundId, round.id), eq(roundMultiValues.field, change.key)),
          );
        transactionFault.maybeThrow("after-multi-delete");
        if (change.next.length > 0) {
          await tx
            .insert(roundMultiValues)
            .values(change.next.map((value) => ({ roundId: round.id, field: change.key, value })));
        }
      }
      for (const change of customChanges) {
        if (change.existingId) {
          await tx
            .update(customColumnValues)
            .set({ value: change.next || null })
            .where(eq(customColumnValues.id, change.existingId));
        } else if (change.next) {
          await tx
            .insert(customColumnValues)
            .values({ columnId: change.columnId, roundId: round.id, value: change.next });
        }
      }
      if (auditRows.length > 0) await tx.insert(auditLog).values(auditRows);
    });
    return { changed: Object.keys(patch).length, audited: auditRows.length };
  },

  async updateRoundCell(principal: Principal, roundId: number, key: string, value: string) {
    if (key.startsWith("custom:")) {
      const columnId = Number(key.slice("custom:".length));
      if (!Number.isInteger(columnId)) throw DomainError.badRequest("Unknown column");
      return pursuitService.savePostBidData(principal, {
        roundId,
        values: {},
        multiValues: {},
        customValues: { [columnId]: value },
      });
    }
    if (!ROUND_COLUMN_KEYS.includes(key)) {
      throw DomainError.badRequest(
        "That column is not editable from a sheet — open the record instead.",
      );
    }
    return pursuitService.savePostBidData(principal, {
      roundId,
      values: { [key]: value },
      multiValues: {},
      customValues: {},
    });
  },

  async approveAndLock(principal: Principal, roundId: number) {
    const loaded = await loadRoundForPrincipal(principal, roundId);
    if (!loaded) throw DomainError.notFound("Round not found");
    const round = loaded.value.round;

    requireAuthorized(
      principal,
      "approve",
      {
        type: "round",
        id: round.id,
        region: round.region,
        ownerId: null,
        published: true,
        deleted: false,
        round: { status: round.status, region: round.region },
      },
      "Round",
    );

    if (round.status !== "post_bid") {
      throw DomainError.badRequest("Record must be in Post-Bid Data Entry to approve");
    }

    const row = await getRoundWithJob(roundId);
    if (!row) throw DomainError.notFound("Round not found");
    const multi = await getMultiValues(round.id);
    const gate = evaluateLockGate(round, multi, {
      jobNumber: row.job.jobNumber,
      jobName: row.job.jobName,
      estimateLeadName: row.estimateLeadName,
    });
    if (!gate.ok) {
      return {
        ok: false as const,
        error: gate.error,
        missingFields: gate.missingFields,
      };
    }

    await withTransaction(async (tx) => {
      await updateRoundIfUnchanged(tx, {
        roundId: round.id,
        expectedStatus: "post_bid",
        expectedUpdatedAt: round.updatedAt,
        patch: { status: "locked", lockedAt: new Date() },
      });
      await tx.insert(statusTransitions).values({
        roundId: round.id,
        fromStatus: round.status,
        toStatus: "locked",
        userId: principal.user.id,
      });
    });

    return { ok: true as const };
  },

  async setOutcome(principal: Principal, roundId: number, outcome: OutcomeValue) {
    const loaded = await loadRoundForPrincipal(principal, roundId);
    if (!loaded) throw DomainError.notFound("Round not found");
    const round = loaded.value.round;
    const user = principal.user;

    // Field-level gate: outcome edits on locked rounds require RPD; kernel enforces region.
    if (round.status === "locked") {
      await requireRoundFieldWrite(principal, roundId, "outcome");
    } else {
      requireAuthorized(
        principal,
        "edit",
        {
          type: "round",
          id: round.id,
          region: round.region,
          ownerId: null,
          published: true,
          deleted: false,
          round: { status: round.status, region: round.region },
        },
        "Round",
      );
    }

    const { audit } = planOutcomeUpdate(user, round, outcome);
    await db
      .update(estimateRounds)
      .set({ outcome, updatedAt: new Date() })
      .where(eq(estimateRounds.id, roundId));

    if (audit) {
      await db.insert(auditLog).values({
        ...audit,
        userId: user.id,
      });
    }
    return { roundId, outcome };
  },
};

async function requireRoundFieldWrite(principal: Principal, roundId: number, fieldKey: string) {
  const loaded = await loadRoundForPrincipal(principal, roundId, {
    capability: "edit",
    fieldKey,
  });
  if (!loaded) {
    // Distinguish not-found from field-policy denial after a successful read.
    const readable = await loadRoundForPrincipal(principal, roundId);
    if (!readable) throw DomainError.notFound("Round not found");
    throw DomainError.forbidden(
      `Not permitted to edit field ${fieldKey}`,
      "Field policy or role does not allow this write.",
    );
  }
  const decision = authorize(principal, "edit", {
    ...loaded.descriptor,
    fieldKey,
  });
  if (!decision.allowed) {
    throw DomainError.forbidden(
      `Not permitted to edit field ${fieldKey}`,
      `Authorization denied (${decision.reason}).`,
    );
  }
  return loaded.value.round;
}
