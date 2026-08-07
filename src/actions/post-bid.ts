"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  customColumnValues,
  customColumns,
  estimateRounds,
  roundMultiValues,
  statusTransitions,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getMultiValues, getReferenceValues, getRoundWithJob } from "@/lib/queries";
import {
  canApproveLock,
  canEditAfterLock,
  canEnterPostBid,
} from "@/lib/permissions";
import { MULTI_FIELD_KEYS, ROUND_COLUMN_KEYS } from "@/lib/fields";
import { missingRequiredFields, validateFieldValue } from "@/lib/validation";
import { DomainError } from "@/domain/errors";
import { planOutcomeUpdate } from "@/lib/outcome";

export type SaveInput = {
  roundId: number;
  /** Scalar field values keyed by field key (raw strings from the form). */
  values: Record<string, string>;
  /** Multi-select fields keyed by field key. */
  multiValues: Record<string, string[]>;
  /** Custom column values keyed by column id. */
  customValues: Record<number, string>;
  estimateLeadId?: number | null;
};

export async function savePostBidData(input: SaveInput) {
  const user = await getCurrentUser();
  const [round] = await db
    .select()
    .from(estimateRounds)
    .where(eq(estimateRounds.id, input.roundId));
  if (!round) throw new Error("Round not found");

  const locked = round.status === "locked";
  if (locked) {
    if (!canEditAfterLock(user, round))
      throw DomainError.forbidden(
        "Record is locked — only the RPD/SPD can make corrections",
        "Post-lock edits are limited to the regional RPD/SPD.",
      );
  } else if (!canEnterPostBid(user, round) && !["active", "upcoming", "outstanding"].includes(round.status)) {
    throw new Error("Not permitted to edit this record");
  }

  const lists = await getReferenceValues();
  const patch: Record<string, unknown> = {};
  const auditRows: (typeof auditLog.$inferInsert)[] = [];

  for (const [key, raw] of Object.entries(input.values)) {
    if (!ROUND_COLUMN_KEYS.includes(key)) continue;
    const result = validateFieldValue(key, raw, lists);
    if (!result.ok) throw new Error(result.error);
    const oldValue = (round as unknown as Record<string, unknown>)[key];
    const newValue = result.value;
    const changed =
      (oldValue ?? null) !== (newValue ?? null) &&
      String(oldValue ?? "") !== String(newValue ?? "");
    if (changed) {
      patch[key] = newValue;
      // Post-lock edits must be captured in the audit log (BRD Section 4)
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

  if (Object.keys(patch).length > 0) {
    const { appendEntityVersion } = await import("@/lib/recovery");
    await appendEntityVersion("round", round.id, { ...round }, user.id);
    patch.updatedAt = new Date();
    await db.update(estimateRounds).set(patch).where(eq(estimateRounds.id, round.id));
  }

  // Multi-value fields: replace the set per field
  const existingMulti = await getMultiValues(round.id);
  for (const key of MULTI_FIELD_KEYS) {
    if (!(key in input.multiValues)) continue;
    const next = [...new Set(input.multiValues[key])];
    const prev = existingMulti[key] ?? [];
    if (JSON.stringify([...prev].sort()) === JSON.stringify([...next].sort())) continue;
    await db
      .delete(roundMultiValues)
      .where(and(eq(roundMultiValues.roundId, round.id), eq(roundMultiValues.field, key)));
    if (next.length > 0) {
      await db
        .insert(roundMultiValues)
        .values(next.map((value) => ({ roundId: round.id, field: key, value })));
    }
    if (locked) {
      auditRows.push({
        entity: "round",
        entityId: round.id,
        roundId: round.id,
        action: "post_lock_edit",
        field: key,
        oldValue: prev.join(", "),
        newValue: next.join(", "),
        userId: user.id,
      });
    }
  }

  // Custom column values
  const colIds = Object.keys(input.customValues).map(Number);
  if (colIds.length > 0) {
    const cols = await db
      .select()
      .from(customColumns)
      .where(inArray(customColumns.id, colIds));
    for (const col of cols) {
      const raw = input.customValues[col.id] ?? "";
      const [existing] = await db
        .select()
        .from(customColumnValues)
        .where(
          and(
            eq(customColumnValues.columnId, col.id),
            eq(customColumnValues.roundId, round.id),
          ),
        );
      if (existing) {
        if ((existing.value ?? "") !== raw) {
          await db
            .update(customColumnValues)
            .set({ value: raw || null })
            .where(eq(customColumnValues.id, existing.id));
        }
      } else if (raw) {
        await db
          .insert(customColumnValues)
          .values({ columnId: col.id, roundId: round.id, value: raw });
      }
    }
  }

  if (auditRows.length > 0) await db.insert(auditLog).values(auditRows);

  revalidatePath(`/rounds/${round.id}`);
  revalidatePath("/post-bid");
  revalidatePath("/bid-schedule");
  return { changed: Object.keys(patch).length, audited: auditRows.length };
}

/**
 * Single-cell edit from a sheet grid. Delegates to `savePostBidData` so a
 * value typed into a sheet passes exactly the same validation, permission and
 * post-lock audit path as the same value typed into the entry form — the
 * grid is a different surface, not a different rulebook.
 */
export async function updateRoundCell(roundId: number, key: string, value: string) {
  if (key.startsWith("custom:")) {
    const columnId = Number(key.slice("custom:".length));
    if (!Number.isInteger(columnId)) throw new Error("Unknown column");
    return savePostBidData({ roundId, values: {}, multiValues: {}, customValues: { [columnId]: value } });
  }
  if (!ROUND_COLUMN_KEYS.includes(key))
    throw new Error("That column is not editable from a sheet — open the record instead.");
  return savePostBidData({ roundId, values: { [key]: value }, multiValues: {}, customValues: {} });
}

/** RPD approval: validates required completeness, then locks the record. */
export async function approveAndLock(roundId: number) {
  const user = await getCurrentUser();
  const row = await getRoundWithJob(roundId);
  if (!row) throw new Error("Round not found");
  const { round, job, estimateLeadName } = row;

  if (!canApproveLock(user, round))
    throw DomainError.forbidden(
      "Only the RPD/SPD for this Region can approve and lock records",
      "Approval is reserved for the regional RPD/SPD.",
    );
  if (round.status !== "post_bid")
    throw DomainError.badRequest(
      "Record must be in Post-Bid Data Entry to approve",
    );

  const multi = await getMultiValues(round.id);
  const missing = missingRequiredFields(round, multi, {
    jobNumber: job.jobNumber,
    jobName: job.jobName,
    estimateLeadName,
  });
  if (missing.length > 0) {
    throw new Error(
      `Cannot lock — ${missing.length} required field${missing.length === 1 ? " is" : "s are"} blank: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}`,
    );
  }

  await db
    .update(estimateRounds)
    .set({ status: "locked", lockedAt: new Date(), updatedAt: new Date() })
    .where(eq(estimateRounds.id, round.id));
  await db.insert(statusTransitions).values({
    roundId: round.id,
    fromStatus: round.status,
    toStatus: "locked",
    userId: user.id,
  });

  revalidatePath(`/rounds/${round.id}`);
  revalidatePath("/post-bid");
  return { ok: true };
}

/** Record the pursuit outcome (Successful / Pending / Unsuccessful). */
export async function setOutcome(
  roundId: number,
  outcome: "pending" | "successful" | "unsuccessful",
) {
  const user = await getCurrentUser();
  const [round] = await db
    .select()
    .from(estimateRounds)
    .where(eq(estimateRounds.id, roundId));
  if (!round) throw DomainError.notFound("Round not found");

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
  revalidatePath(`/rounds/${roundId}`);
}
