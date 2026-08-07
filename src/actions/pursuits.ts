"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  estimateRounds,
  jobs,
  notifications,
  statusTransitions,
  users,
} from "@/db/schema";
import type { RoundStatus } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { connectProvider } from "@/lib/integrations/connect";
import { sendEmails } from "@/lib/email";
import { getNotificationSettings } from "@/lib/reminders";
import {
  allowedTransitions,
  canCreatePursuit,
  canEditBidSchedule,
  STATUS_LABELS,
} from "@/lib/permissions";
import { DomainError } from "@/domain/errors";
import { planSalesforceLink } from "@/lib/salesforce-link";

export async function searchSalesforceJobs(query: string) {
  if (query.trim().length < 2) return [];
  return connectProvider().search(query);
}

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
};

export async function createPursuit(input: CreatePursuitInput) {
  const user = await getCurrentUser();
  if (!canCreatePursuit(user)) throw new Error("Not permitted to create pursuits");

  let jobNumber: string;
  let jobName: string;
  let salesforceId: string | null = null;
  let isLinked = false;
  let city = input.city ?? null;
  let state = input.state ?? null;
  let marketSector = input.marketSector ?? null;

  if (input.mode === "salesforce") {
    const sf = await connectProvider().getById(input.sfId ?? "");
    if (!sf) throw new Error("Salesforce job not found");
    jobNumber = sf.jobNumber;
    jobName = sf.jobName;
    salesforceId = sf.sfId;
    isLinked = true;
    city = city ?? sf.city;
    state = state ?? sf.state;
    marketSector = marketSector ?? sf.marketSector;
  } else {
    if (!input.jobName?.trim()) throw new Error("Job Name is required for manual pursuits");
    jobName = input.jobName.trim();
    // Placeholder identifier until a Salesforce Job Number exists (BRD Section 5)
    jobNumber = `TBD-${1000 + Math.floor(Math.random() * 9000)}`;
  }

  const [job] = await db
    .insert(jobs)
    .values({
      jobNumber,
      jobName,
      region: input.region,
      preconDepartment: input.preconDepartment,
      salesforceId,
      isLinked,
      createdById: user.id,
    })
    .returning();

  const [round] = await db
    .insert(estimateRounds)
    .values({
      jobId: job.id,
      roundNumber: 1,
      status: input.initialStatus,
      region: input.region,
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

  await db.insert(statusTransitions).values({
    roundId: round.id,
    fromStatus: null,
    toStatus: input.initialStatus,
    userId: user.id,
  });

  revalidatePath("/bid-schedule");
  return { jobId: job.id, roundId: round.id };
}

export type AddRoundInput = {
  jobId: number;
  estimatePhase: string;
  bidYear: number;
  bidDueDate?: string;
  initialStatus: "active" | "upcoming" | "outstanding";
};

export async function addEstimateRound(input: AddRoundInput) {
  const user = await getCurrentUser();
  if (!canCreatePursuit(user)) throw new Error("Not permitted to add estimate rounds");

  const [job] = await db.select().from(jobs).where(eq(jobs.id, input.jobId));
  if (!job) throw new Error("Job not found");

  const existing = await db
    .select({ n: estimateRounds.roundNumber, r: estimateRounds })
    .from(estimateRounds)
    .where(eq(estimateRounds.jobId, job.id));
  const maxRound = Math.max(0, ...existing.map((e) => e.n));
  // Carry forward core fields from the most recent round, like copying a row today
  const latest = existing.sort((a, b) => b.n - a.n)[0]?.r;

  const [round] = await db
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
      estimateLeadId: latest?.estimateLeadId ?? null,
      createdById: user.id,
    })
    .returning();

  await db.insert(statusTransitions).values({
    roundId: round.id,
    fromStatus: null,
    toStatus: input.initialStatus,
    userId: user.id,
  });

  revalidatePath("/bid-schedule");
  revalidatePath(`/jobs/${job.id}`);
  return { roundId: round.id };
}

export async function transitionStatus(roundId: number, to: RoundStatus) {
  const user = await getCurrentUser();
  const [round] = await db
    .select()
    .from(estimateRounds)
    .where(eq(estimateRounds.id, roundId));
  if (!round) throw new Error("Round not found");

  const allowed = allowedTransitions(user, round);
  if (!allowed.includes(to)) {
    throw new Error(
      `${user.name} cannot move this round from ${STATUS_LABELS[round.status]} to ${STATUS_LABELS[to]}`,
    );
  }

  const patch: Partial<typeof estimateRounds.$inferInsert> = {
    status: to,
    updatedAt: new Date(),
  };
  if (to === "submitted") patch.submittedAt = new Date();

  await db.update(estimateRounds).set(patch).where(eq(estimateRounds.id, roundId));
  await db.insert(statusTransitions).values({
    roundId,
    fromStatus: round.status,
    toStatus: to,
    userId: user.id,
  });

  // Automated notification: Submitted → remind the assigned Estimate Lead (BRD Section 4)
  if (to === "submitted") {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, round.jobId));
    const targetId =
      round.estimateLeadId ??
      (await db.select().from(users).where(eq(users.role, "estimate_lead")))[0]?.id;
    if (targetId) {
      const title = `Post-bid data needed: ${job?.jobName ?? "Pursuit"}`;
      const body = `${round.estimatePhase} (Bid Year ${round.bidYear}) moved to Submitted. Complete the remaining post-bid fields.`;
      const settings = await getNotificationSettings();

      if (settings.inApp) {
        await db.insert(notifications).values({ userId: targetId, title, body, roundId });
      }
      if (settings.email) {
        const [target] = await db.select().from(users).where(eq(users.id, targetId));
        if (target?.email) {
          await sendEmails([
            {
              toEmail: target.email,
              toUserId: target.id,
              subject: title,
              body: `${body}\n\nOpen the round to finish entry: /rounds/${roundId}`,
              kind: "submitted",
              roundId,
            },
          ]);
        }
      }
    }
  }

  revalidatePath("/bid-schedule");
  revalidatePath("/post-bid");
  revalidatePath(`/rounds/${roundId}`);
}

export async function assignEstimateLead(roundId: number, userId: number | null) {
  const user = await getCurrentUser();
  if (!canEditBidSchedule(user)) throw new Error("Not permitted");
  await db
    .update(estimateRounds)
    .set({ estimateLeadId: userId, updatedAt: new Date() })
    .where(eq(estimateRounds.id, roundId));
  revalidatePath("/bid-schedule");
  revalidatePath(`/rounds/${roundId}`);
}

/** Match-and-merge: link a manual job to a Salesforce record (BRD Section 5). */
export async function linkJobToSalesforce(jobId: number, sfId: string) {
  const user = await getCurrentUser();
  if (!canEditBidSchedule(user)) {
    throw DomainError.forbidden(
      "Not permitted to link Salesforce jobs",
      "Bid-schedule edit permission is required.",
    );
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw DomainError.notFound("Job not found");

  const sf = await connectProvider().getById(sfId);
  const existingRounds = await db
    .select({ id: estimateRounds.id })
    .from(estimateRounds)
    .where(eq(estimateRounds.jobId, jobId));

  // Pure planner: same job id, every round id preserved (ROM history stays intact).
  const plan = planSalesforceLink(
    job,
    sf,
    existingRounds.map((r) => r.id),
  );

  await db.update(jobs).set(plan.patch).where(eq(jobs.id, plan.jobId));

  // Match confirmations must be logged (BRD Section 16)
  await db.insert(auditLog).values({
    entity: plan.audit.entity,
    entityId: plan.jobId,
    action: plan.audit.action,
    field: plan.audit.field,
    oldValue: plan.audit.oldValue,
    newValue: plan.audit.newValue,
    userId: user.id,
  });

  revalidatePath(`/jobs/${plan.jobId}`);
  revalidatePath("/bid-schedule");
  return {
    jobId: plan.jobId,
    preservedRoundIds: plan.preservedRoundIds,
  };
}

/** Candidate Salesforce matches for a manual job (name/region/sector similarity). */
export async function getSalesforceCandidates(jobId: number) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job || job.isLinked) return [];

  const linkedIds = (await db.select({ sfId: jobs.salesforceId }).from(jobs))
    .map((r) => r.sfId)
    .filter(Boolean) as string[];

  const all = await connectProvider().list();
  const tokens = job.jobName.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  return all
    .filter((sf) => !linkedIds.includes(sf.sfId))
    .map((sf) => {
      const name = sf.jobName.toLowerCase();
      let score = 0;
      for (const t of tokens) if (name.includes(t)) score += 2;
      if (sf.region === job.region) score += 1;
      return { sf, score };
    })
    .filter((c) => c.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((c) => c.sf);
}
