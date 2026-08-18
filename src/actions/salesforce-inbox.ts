"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  auditLog,
  estimateRounds,
  jobs,
  salesforceMatchCandidates,
  salesforceMatchSuppressions,
  salesforceSyncRuns,
} from "@/db/schema";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { connectProvider } from "@/lib/integrations/connect";
import { planSalesforceLink } from "@/lib/salesforce-link";
import { proposeMatches } from "@/lib/salesforce-match";
import { withTransaction } from "@/lib/transactions";
import { assertPrincipalAdmin } from "@/services/mutation-policy";

export async function runSalesforceSync() {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "salesforce", "edit", "Salesforce sync");

  const [run] = await db
    .insert(salesforceSyncRuns)
    .values({ status: "running", cursor: new Date().toISOString() })
    .returning();

  try {
    const provider = connectProvider();
    const opps = await provider.list();
    const allJobs = await db.select().from(jobs);
    const suppressions = await db.select().from(salesforceMatchSuppressions);

    const candidates = proposeMatches(
      allJobs
        .filter((j) => !j.deletedAt)
        .map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          jobName: j.jobName,
          region: j.region,
          isLinked: j.isLinked,
          salesforceId: j.salesforceId,
        })),
      opps.map((o) => ({
        sfId: o.sfId,
        jobNumber: o.jobNumber,
        jobName: o.jobName,
        region: o.region,
        sourceVersion: `${o.sfId}:${o.jobNumber}:${o.createdDate ?? "0"}`,
      })),
      suppressions
    );

    // Single bulk insert; the partial unique index on (job_id, sf_id,
    // source_version) makes re-proposals no-ops without a select-per-candidate.
    let created = 0;
    if (candidates.length > 0) {
      const inserted = await db
        .insert(salesforceMatchCandidates)
        .values(
          candidates.map((c) => ({
            syncRunId: run.id,
            jobId: c.jobId,
            sfId: c.sfId,
            sourceVersion: c.sourceVersion,
            proposedJobNumber: c.proposedJobNumber,
            proposedJobName: c.proposedJobName,
            proposedRegion: c.proposedRegion,
            score: c.score,
            signals: c.signals,
            discrepancy: c.discrepancy,
            status: "pending" as const,
          }))
        )
        .onConflictDoNothing()
        .returning({ id: salesforceMatchCandidates.id });
      created = inserted.length;
    }

    await db
      .update(salesforceSyncRuns)
      .set({
        status: "completed",
        opportunitiesSeen: opps.length,
        candidatesCreated: created,
        finishedAt: new Date(),
      })
      .where(eq(salesforceSyncRuns.id, run.id));

    revalidatePath("/admin");
    return { runId: run.id, seen: opps.length, created };
  } catch (e) {
    await db
      .update(salesforceSyncRuns)
      .set({
        status: "failed",
        error: e instanceof Error ? e.message : "Unknown error",
        finishedAt: new Date(),
      })
      .where(eq(salesforceSyncRuns.id, run.id));
    throw e;
  }
}

export async function decideMatchCandidate(
  candidateId: number,
  decision: "approve" | "reject" | "dismiss",
  note?: string
) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "salesforce", "edit", "Salesforce match");
  const user = principal.user;
  const [c] = await db
    .select()
    .from(salesforceMatchCandidates)
    .where(eq(salesforceMatchCandidates.id, candidateId));
  if (c?.status !== "pending") throw new Error("Candidate not found");

  if (decision === "reject" || decision === "dismiss") {
    await withTransaction(async (tx) => {
      // Guarded claim: only one concurrent decision can flip a pending row.
      const [claimed] = await tx
        .update(salesforceMatchCandidates)
        .set({
          status: decision === "reject" ? "rejected" : "dismissed",
          decidedById: user.id,
          decidedAt: new Date(),
          decisionNote: note ?? null,
        })
        .where(
          and(
            eq(salesforceMatchCandidates.id, candidateId),
            eq(salesforceMatchCandidates.status, "pending")
          )
        )
        .returning({ id: salesforceMatchCandidates.id });
      if (!claimed) throw new Error("Candidate not found");
      await tx.insert(salesforceMatchSuppressions).values({
        jobId: c.jobId,
        sfId: c.sfId,
        sourceVersion: c.sourceVersion,
        reason: decision,
        createdById: user.id,
      });
      await tx.insert(auditLog).values({
        entity: "salesforce_match",
        entityId: candidateId,
        action: decision,
        field: c.sfId,
        userId: user.id,
      });
    });
    revalidatePath("/admin");
    return;
  }

  // approve / link — preserve job + round IDs
  const jobId = c.jobId;
  if (!jobId) throw new Error("Candidate missing job");
  if (
    c.discrepancy?.includes("job_number_mismatch") &&
    note !== "confirm-job-number"
  ) {
    throw new Error(
      "Job number discrepancy requires confirmation (pass note confirm-job-number)."
    );
  }

  await withTransaction(async (tx) => {
    // Guarded claim first: only one concurrent decision links the candidate.
    const [claimed] = await tx
      .update(salesforceMatchCandidates)
      .set({
        status: "linked",
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: note ?? null,
      })
      .where(
        and(
          eq(salesforceMatchCandidates.id, candidateId),
          eq(salesforceMatchCandidates.status, "pending")
        )
      )
      .returning({ id: salesforceMatchCandidates.id });
    if (!claimed) throw new Error("Candidate not found");

    const [job] = await tx.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw new Error("Job missing");

    if (job.isLinked) {
      // Discrepancy confirmation path — keep job/round IDs, update identity fields only.
      await tx
        .update(jobs)
        .set({
          jobNumber: c.proposedJobNumber || job.jobNumber,
          jobName: c.proposedJobName || job.jobName,
          salesforceId: c.sfId,
        })
        .where(eq(jobs.id, job.id));
    } else {
      const rounds = await tx
        .select({ id: estimateRounds.id })
        .from(estimateRounds)
        .where(eq(estimateRounds.jobId, job.id));
      const plan = planSalesforceLink(
        {
          id: job.id,
          jobNumber: job.jobNumber,
          jobName: job.jobName,
          salesforceId: job.salesforceId,
          isLinked: job.isLinked,
        },
        {
          sfId: c.sfId,
          jobNumber: c.proposedJobNumber || job.jobNumber,
          jobName: c.proposedJobName || job.jobName,
        },
        rounds.map((r) => r.id)
      );
      await tx.update(jobs).set(plan.patch).where(eq(jobs.id, job.id));
    }

    // Rounds stay on the same job id (history preserved). No blanket
    // updated_at touch here — that would invalidate other users' optimistic
    // save snapshots on every round of the job.

    await tx.insert(auditLog).values({
      entity: "job_match",
      entityId: job.id,
      action: "salesforce_linked",
      field: "salesforceId",
      oldValue: job.salesforceId,
      newValue: c.sfId,
      userId: user.id,
    });
  });
  revalidatePath("/admin");
  revalidatePath(`/jobs/${jobId}`);
}
