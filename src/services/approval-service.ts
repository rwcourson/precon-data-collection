import "server-only";
import { and, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  type ApprovalRequest,
  approvalRequests,
  auditLog,
  estimateRounds,
  groupEditPolicies,
  jobGroupMemberships,
  jobs,
  users,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import {
  createPrincipal,
  principalAllowsRegion,
} from "@/lib/authorization/principal";
import type { Principal } from "@/lib/authorization/types";
import { findDuplicateJobs } from "@/lib/duplicate-jobs";
import { connectProvider } from "@/lib/integrations/connect";
import { recordProductEvent } from "@/services/product-events-service";
import {
  type CreatePursuitInput,
  type CreatePursuitResult,
  pursuitService,
  type SavePostBidInput,
} from "@/services/pursuit-service";

export type ApprovalWriteMode = "direct" | "propose" | "read";

export const approvalService = {
  async writeMode(
    principal: Principal,
    jobId?: number | null
  ): Promise<ApprovalWriteMode> {
    if (principal.user.role === "leadership") return "read";
    if (principal.user.role === "corporate_admin") return "direct";
    if (jobId) {
      const policies = await db
        .select({ mode: groupEditPolicies.mode })
        .from(jobGroupMemberships)
        .innerJoin(
          groupEditPolicies,
          and(
            eq(groupEditPolicies.groupId, jobGroupMemberships.groupId),
            eq(groupEditPolicies.role, principal.user.role)
          )
        )
        .where(eq(jobGroupMemberships.jobId, jobId));
      const rank: Record<ApprovalWriteMode, number> = {
        read: 0,
        propose: 1,
        direct: 2,
      };
      let mode: ApprovalWriteMode | null = null;
      for (const policy of policies) {
        if (
          policy.mode !== "direct" &&
          policy.mode !== "propose" &&
          policy.mode !== "read"
        )
          continue;
        if (mode == null || rank[policy.mode] < rank[mode]) mode = policy.mode;
      }
      if (mode) return mode;
    }
    return principal.user.role === "pcm" ? "propose" : "direct";
  },

  async writeModeForRound(principal: Principal, roundId: number) {
    const [row] = await db
      .select({ jobId: estimateRounds.jobId })
      .from(estimateRounds)
      .where(eq(estimateRounds.id, roundId))
      .limit(1);
    return approvalService.writeMode(principal, row?.jobId);
  },

  async listRecentHighlights(
    principal: Principal
  ): Promise<{ roundId: number | null; jobId: number | null }[]> {
    const scope =
      principal.user.role === "corporate_admin" ||
      principal.allowedRegions === "all"
        ? undefined
        : principal.workspace.kind === "region"
          ? principal.workspace.region
          : principal.user.region;
    return db
      .select({
        roundId: approvalRequests.publishedRoundId,
        jobId: approvalRequests.publishedJobId,
      })
      .from(approvalRequests)
      .where(
        and(
          gt(approvalRequests.highlightUntil, new Date()),
          or(
            isNotNull(approvalRequests.publishedJobId),
            isNotNull(approvalRequests.publishedRoundId)
          ),
          scope ? eq(approvalRequests.region, scope) : undefined
        )
      );
  },

  async requestCreate(
    principal: Principal,
    input: CreatePursuitInput
  ): Promise<CreatePursuitResult | { kind: "pending"; requestId: number }> {
    let jobName = input.jobName?.trim() ?? "";
    let city = input.city ?? null;
    let state = input.state ?? null;
    if (input.mode === "salesforce") {
      const source = await connectProvider().getById(input.sfId ?? "");
      if (!source) throw DomainError.notFound("Salesforce job not found");
      jobName = source.jobName;
      city = city ?? source.city;
      state = state ?? source.state;
    }
    if (!input.confirmDuplicate) {
      const existing = await db
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
        .leftJoin(
          estimateRounds,
          and(
            eq(estimateRounds.jobId, jobs.id),
            isNull(estimateRounds.deletedAt)
          )
        )
        .where(isNull(jobs.deletedAt));
      const duplicates = findDuplicateJobs(
        { jobName, city, state, owner: null },
        existing
      );
      const pendingCreates = await db
        .select()
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.kind, "create"),
            eq(approvalRequests.status, "pending")
          )
        );
      const pendingExisting = pendingCreates.flatMap((request) => {
        const pursuit = request.payload.pursuit ?? {};
        const pendingName = String(pursuit.jobName ?? "").trim();
        if (!pendingName) return [];
        return [
          {
            jobId: request.id,
            jobName: pendingName,
            jobNumber: "Pending approval",
            homeRegion: request.region,
            creatorName: null,
            city: typeof pursuit.city === "string" ? pursuit.city : city,
            state: typeof pursuit.state === "string" ? pursuit.state : state,
            owner: null,
            lastActivityAt: request.requestedAt,
          },
        ];
      });
      const pendingDuplicates = findDuplicateJobs(
        { jobName, city, state, owner: null },
        pendingExisting
      );
      const allDuplicates = [...duplicates, ...pendingDuplicates];
      if (allDuplicates.length)
        return { kind: "duplicates", matches: allDuplicates };
    }
    const [request] = await db
      .insert(approvalRequests)
      .values({
        kind: "create",
        region: input.region,
        payload: { pursuit: input as unknown as Record<string, unknown> },
        requestedById: principal.user.id,
      })
      .returning({ id: approvalRequests.id });
    await recordProductEvent(principal, "approval.requested", {
      kind: "create",
      requestId: request.id,
    });
    return { kind: "pending", requestId: request.id };
  },

  async requestEdit(principal: Principal, input: SavePostBidInput) {
    const [round] = await db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.id, input.roundId));
    if (!round) throw DomainError.notFound("Round not found");
    const [request] = await db
      .insert(approvalRequests)
      .values({
        kind: "edit",
        region: round.region,
        jobId: round.jobId,
        roundId: round.id,
        payload: {
          values: input.values,
          multiValues: input.multiValues,
          customValues: Object.fromEntries(
            Object.entries(input.customValues).map(([key, value]) => [
              String(key),
              value,
            ])
          ),
          pursuit: {
            estimateLeadId: input.estimateLeadId,
          },
        },
        expectedUpdatedAt: input.expectedUpdatedAt
          ? new Date(input.expectedUpdatedAt)
          : round.updatedAt,
        requestedById: principal.user.id,
      })
      .returning({ id: approvalRequests.id });
    await recordProductEvent(principal, "approval.requested", {
      kind: "edit",
      requestId: request.id,
      roundId: round.id,
    });
    return request;
  },

  async list(principal: Principal): Promise<ApprovalRequest[]> {
    const scope =
      principal.user.role === "corporate_admin" ||
      principal.allowedRegions === "all"
        ? undefined
        : principal.workspace.kind === "region"
          ? principal.workspace.region
          : principal.user.region;
    return db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.status, "pending"),
          scope ? eq(approvalRequests.region, scope) : undefined,
          ["rpd", "corporate_admin"].includes(principal.user.role)
            ? undefined
            : eq(approvalRequests.requestedById, principal.user.id)
        )
      )
      .orderBy(desc(approvalRequests.requestedAt));
  },

  async decide(
    principal: Principal,
    requestId: number,
    decision: "approved" | "rejected",
    reason?: string
  ) {
    const [request] = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.id, requestId),
          eq(approvalRequests.status, "pending")
        )
      );
    if (!request) throw DomainError.notFound("Approval request not found");
    if (
      !["rpd", "corporate_admin"].includes(principal.user.role) ||
      !principalAllowsRegion(principal, request.region)
    ) {
      throw DomainError.forbidden("Not permitted to decide this request.");
    }
    if (decision === "rejected") {
      await db
        .update(approvalRequests)
        .set({
          status: "rejected",
          decidedById: principal.user.id,
          decidedAt: new Date(),
          decisionReason: reason?.trim() || null,
        })
        .where(eq(approvalRequests.id, request.id));
      await recordProductEvent(principal, "approval.decided", {
        requestId,
        decision,
      });
      return { status: "rejected" as const };
    }

    if (request.kind === "create") {
      const input = request.payload.pursuit as unknown as CreatePursuitInput;
      const [requester] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.requestedById))
        .limit(1);
      if (!requester) throw DomainError.notFound("Requester not found");
      const publisher = createPrincipal({
        user: requester,
        authSource: "sso",
        workspaceRegion: request.region,
      });
      const result = await pursuitService.createPursuit(publisher, {
        ...input,
        confirmDuplicate: true,
      });
      if (result.kind !== "created")
        throw DomainError.conflict("Create approval could not publish.");
      await db
        .update(approvalRequests)
        .set({
          status: "approved",
          decidedById: principal.user.id,
          decidedAt: new Date(),
          decisionReason: reason?.trim() || null,
          publishedJobId: result.jobId,
          publishedRoundId: result.roundId,
          highlightUntil: new Date(Date.now() + 14 * 86_400_000),
        })
        .where(eq(approvalRequests.id, request.id));
      await db.insert(auditLog).values({
        entity: "round",
        entityId: result.roundId,
        roundId: result.roundId,
        action: "approved_to_schedule",
        field: "status",
        oldValue: "draft",
        newValue: input.initialStatus,
        userId: principal.user.id,
      });
      await recordProductEvent(principal, "approval.decided", {
        requestId,
        decision,
        jobId: result.jobId,
        roundId: result.roundId,
      });
      return { status: "approved" as const, ...result };
    }

    if (!request.roundId)
      throw DomainError.badRequest("Edit request has no round.");
    const customValues = Object.fromEntries(
      Object.entries(request.payload.customValues ?? {}).map(([key, value]) => [
        Number(key),
        String(value ?? ""),
      ])
    );
    const [requester] = await db
      .select()
      .from(users)
      .where(eq(users.id, request.requestedById))
      .limit(1);
    if (!requester) throw DomainError.notFound("Requester not found");
    const editor = createPrincipal({
      user: requester,
      authSource: "sso",
      workspaceRegion: request.region,
    });
    try {
      const result = await pursuitService.savePostBidData(editor, {
        roundId: request.roundId,
        values: Object.fromEntries(
          Object.entries(request.payload.values ?? {}).map(([key, value]) => [
            key,
            String(value ?? ""),
          ])
        ),
        multiValues: request.payload.multiValues ?? {},
        customValues,
        estimateLeadId:
          typeof request.payload.pursuit?.estimateLeadId === "number"
            ? request.payload.pursuit.estimateLeadId
            : undefined,
        expectedUpdatedAt: request.expectedUpdatedAt,
      });
      await db
        .update(approvalRequests)
        .set({
          status: "approved",
          decidedById: principal.user.id,
          decidedAt: new Date(),
          decisionReason: reason?.trim() || null,
          publishedRoundId: request.roundId,
          highlightUntil: new Date(Date.now() + 14 * 86_400_000),
        })
        .where(eq(approvalRequests.id, request.id));
      await recordProductEvent(principal, "approval.decided", {
        requestId,
        decision,
        roundId: request.roundId,
      });
      return { status: "approved" as const, result };
    } catch (error) {
      if (error instanceof DomainError && error.code === "CONFLICT") {
        const [fresh] = await db
          .select()
          .from(estimateRounds)
          .where(eq(estimateRounds.id, request.roundId));
        const proposed = request.payload.values ?? {};
        const diff = Object.entries(proposed).flatMap(([field, value]) => {
          const current = String(
            (fresh as Record<string, unknown> | undefined)?.[field] ?? ""
          );
          const next = String(value ?? "");
          if (current === next) return [];
          return [{ field, current, proposed: next }];
        });
        return { status: "conflict" as const, diff };
      }
      throw error;
    }
  },
};
