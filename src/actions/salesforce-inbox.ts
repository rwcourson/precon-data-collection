"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
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
import { proposeMatches } from "@/lib/salesforce-match";
import { planSalesforceLink } from "@/lib/salesforce-link";
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
      suppressions,
    );

    let created = 0;
    for (const c of candidates) {
      const existing = await db
        .select()
        .from(salesforceMatchCandidates)
        .where(
          and(
            eq(salesforceMatchCandidates.jobId, c.jobId),
            eq(salesforceMatchCandidates.sfId, c.sfId),
            eq(salesforceMatchCandidates.sourceVersion, c.sourceVersion),
          ),
        );
      if (existing[0]) continue;
      await db.insert(salesforceMatchCandidates).values({
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
        status: "pending",
      });
      created++;
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
  note?: string,
) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "salesforce", "edit", "Salesforce match");
  const user = principal.user;
  const [c] = await db
    .select()
    .from(salesforceMatchCandidates)
    .where(eq(salesforceMatchCandidates.id, candidateId));
  if (!c || c.status !== "pending") throw new Error("Candidate not found");

  if (decision === "reject" || decision === "dismiss") {
    await db.insert(salesforceMatchSuppressions).values({
      jobId: c.jobId,
      sfId: c.sfId,
      sourceVersion: c.sourceVersion,
      reason: decision,
      createdById: user.id,
    });
    await db
      .update(salesforceMatchCandidates)
      .set({
        status: decision === "reject" ? "rejected" : "dismissed",
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: note ?? null,
      })
      .where(eq(salesforceMatchCandidates.id, candidateId));
    await db.insert(auditLog).values({
      entity: "salesforce_match",
      entityId: candidateId,
      action: decision,
      field: c.sfId,
      userId: user.id,
    });
    revalidatePath("/admin");
    return;
  }

  // approve / link — preserve job + round IDs
  if (!c.jobId) throw new Error("Candidate missing job");
  if (c.discrepancy?.includes("job_number_mismatch") && note !== "confirm-job-number") {
    throw new Error(
      "Job number discrepancy requires confirmation (pass note confirm-job-number).",
    );
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, c.jobId));
  if (!job) throw new Error("Job missing");

  if (job.isLinked) {
    // Discrepancy confirmation path — keep job/round IDs, update identity fields only.
    await db
      .update(jobs)
      .set({
        jobNumber: c.proposedJobNumber || job.jobNumber,
        jobName: c.proposedJobName || job.jobName,
        salesforceId: c.sfId,
      })
      .where(eq(jobs.id, job.id));
  } else {
    const rounds = await db
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
      rounds.map((r) => r.id),
    );
    await db.update(jobs).set(plan.patch).where(eq(jobs.id, job.id));
  }

  // Rounds stay on the same job id (history preserved)
  await db
    .update(estimateRounds)
    .set({ updatedAt: new Date() })
    .where(eq(estimateRounds.jobId, job.id));

  await db
    .update(salesforceMatchCandidates)
    .set({
      status: "linked",
      decidedById: user.id,
      decidedAt: new Date(),
      decisionNote: note ?? null,
    })
    .where(eq(salesforceMatchCandidates.id, candidateId));

  await db.insert(auditLog).values({
    entity: "job_match",
    entityId: job.id,
    action: "salesforce_linked",
    field: "salesforceId",
    oldValue: job.salesforceId,
    newValue: c.sfId,
    userId: user.id,
  });
  revalidatePath("/admin");
  revalidatePath(`/jobs/${job.id}`);
}
