import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  jobs,
  salesforceMatchCandidates,
  salesforceMatchSuppressions,
  salesforceSyncRuns,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { authorize } from "@/lib/authorization/kernel";
import type { Principal } from "@/lib/authorization/types";
import { connectProvider } from "@/lib/integrations/connect";
import { proposeMatches } from "@/lib/salesforce-match";

export type SalesforcePage = {
  items: Awaited<ReturnType<ReturnType<typeof connectProvider>["list"]>>;
  nextCursor: string | null;
};

/** Transport-neutral Salesforce sync used by cron and interactive admin. */
export const salesforceSyncService = {
  async runIncremental(
    principal: Principal,
    input: { cursor?: string | null; pageSize?: number } = {}
  ) {
    const allowed = authorize(principal, "integrate", {
      type: "admin",
      id: "salesforce",
      region: principal.workspace.region,
      ownerId: null,
      published: true,
      deleted: false,
      adminSection: "salesforce",
    });
    if (!allowed.allowed) {
      throw DomainError.forbidden("Not permitted to run Salesforce sync.");
    }

    const [run] = await db
      .insert(salesforceSyncRuns)
      .values({
        status: "running",
        cursor: input.cursor ?? new Date().toISOString(),
      })
      .returning();

    try {
      const provider = connectProvider();
      // Mock provider list is the full page; real REST would page with cursor.
      const all = await provider.list();
      const pageSize = input.pageSize ?? all.length;
      const start = input.cursor ? Number(input.cursor) || 0 : 0;
      const page = all.slice(start, start + pageSize);
      const nextCursor =
        start + pageSize < all.length ? String(start + pageSize) : null;

      const allJobs = await db
        .select()
        .from(jobs)
        .where(isNull(jobs.deletedAt));
      const suppressions = await db.select().from(salesforceMatchSuppressions);
      const candidates = proposeMatches(
        allJobs.map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          jobName: j.jobName,
          region: j.region,
          isLinked: j.isLinked,
          salesforceId: j.salesforceId,
        })),
        page.map((sf) => ({
          sfId: sf.sfId,
          jobNumber: sf.jobNumber,
          jobName: sf.jobName,
          region: sf.region,
          sourceVersion: `${sf.sfId}:${sf.jobNumber}`,
        })),
        suppressions.map((s) => ({
          jobId: s.jobId,
          sfId: s.sfId,
          sourceVersion: s.sourceVersion,
        }))
      );

      let created = 0;
      for (const candidate of candidates) {
        const existing = await db
          .select({ id: salesforceMatchCandidates.id })
          .from(salesforceMatchCandidates)
          .where(
            and(
              eq(salesforceMatchCandidates.jobId, candidate.jobId),
              eq(salesforceMatchCandidates.sfId, candidate.sfId),
              eq(
                salesforceMatchCandidates.sourceVersion,
                candidate.sourceVersion
              )
            )
          )
          .limit(1);
        if (existing[0]) continue;
        await db.insert(salesforceMatchCandidates).values({
          syncRunId: run.id,
          jobId: candidate.jobId,
          sfId: candidate.sfId,
          sourceVersion: candidate.sourceVersion,
          proposedJobNumber: candidate.proposedJobNumber,
          proposedJobName: candidate.proposedJobName,
          proposedRegion: candidate.proposedRegion,
          score: candidate.score,
          signals: candidate.signals,
          status: "pending",
        });
        created += 1;
      }

      await db
        .update(salesforceSyncRuns)
        .set({
          status: "completed",
          opportunitiesSeen: page.length,
          candidatesCreated: created,
          cursor: nextCursor,
          finishedAt: new Date(),
        })
        .where(eq(salesforceSyncRuns.id, run.id));

      return {
        runId: run.id,
        opportunitiesSeen: page.length,
        candidatesCreated: created,
        nextCursor,
        // No business-row previews in scheduler responses.
      };
    } catch (error) {
      await db
        .update(salesforceSyncRuns)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "sync failed",
          finishedAt: new Date(),
        })
        .where(eq(salesforceSyncRuns.id, run.id));
      throw error;
    }
  },
};
