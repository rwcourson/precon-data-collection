"use server";

import { revalidatePath } from "next/cache";
import { createPursuitSchema } from "@/domain/contracts";
import { db } from "@/db";
import { jobs, type RoundStatus } from "@/db/schema";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { connectProvider } from "@/lib/integrations/connect";
import {
  pursuitService,
  type AddRoundInput,
  type CreatePursuitInput,
} from "@/services/pursuit-service";

export type { CreatePursuitInput, AddRoundInput };

export async function searchSalesforceJobs(query: string) {
  if (query.trim().length < 2) return [];
  return connectProvider().search(query);
}

export async function createPursuit(input: CreatePursuitInput) {
  const parsed = createPursuitSchema.parse(input);
  const principal = await getWebPrincipal();
  const result = await pursuitService.createPursuit(principal, parsed);
  if (result.kind === "created") revalidatePath("/bid-schedule");
  return result;
}

export async function addEstimateRound(input: AddRoundInput) {
  const principal = await getWebPrincipal();
  const result = await pursuitService.addEstimateRound(principal, input);
  revalidatePath("/bid-schedule");
  revalidatePath(`/jobs/${result.jobId}`);
  return { roundId: result.roundId };
}

export async function transitionStatus(roundId: number, to: RoundStatus) {
  const principal = await getWebPrincipal();
  await pursuitService.transitionStatus(principal, roundId, to);
  revalidatePath("/bid-schedule");
  revalidatePath("/post-bid");
  revalidatePath(`/rounds/${roundId}`);
}

export async function assignEstimateLead(roundId: number, userId: number | null) {
  const principal = await getWebPrincipal();
  await pursuitService.assignEstimateLead(principal, roundId, userId);
  revalidatePath("/bid-schedule");
  revalidatePath(`/rounds/${roundId}`);
}

/** Match-and-merge: link a manual job to a Salesforce record (BRD Section 5). */
export async function linkJobToSalesforce(jobId: number, sfId: string) {
  const principal = await getWebPrincipal();
  const result = await pursuitService.linkJobToSalesforce(principal, jobId, sfId);
  revalidatePath(`/jobs/${result.jobId}`);
  revalidatePath("/bid-schedule");
  return result;
}

/** Candidate Salesforce matches for a manual job (name/region/sector similarity). */
export async function getSalesforceCandidates(jobId: number) {
  const principal = await getWebPrincipal();
  const { authorizationService } = await import("@/services/authorization-service");
  const jobResult = await authorizationService.readJob(principal, jobId);
  if (!jobResult.ok) return [];
  const job = jobResult.value;
  if (job.isLinked) return [];

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
