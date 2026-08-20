"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { assertPrincipalAdmin } from "@/services/mutation-policy";
import {
  setGroupEditPolicy,
  setJobGroupMembership,
  setParentJob,
} from "@/services/organization-service";

const membershipSchema = z.object({
  jobId: z.number().int().positive(),
  groupId: z.number().int().positive(),
  enabled: z.boolean(),
  participationRole: z.enum(["lead", "partner", "visibility"]).optional(),
  discipline: z.enum(["preconstruction", "operations"]).optional(),
});

export async function updateJobGroupMembership(raw: unknown) {
  const input = membershipSchema.parse(raw);
  const principal = await getWebPrincipal();
  await setJobGroupMembership(principal, input);
  revalidatePath(`/jobs/${input.jobId}`);
  revalidatePath("/bid-schedule");
}

const parentSchema = z.object({
  childJobId: z.number().int().positive(),
  parentJobId: z.number().int().positive().nullable(),
  kind: z.enum(["sub_job", "tenant_improvement"]).optional(),
});

export async function updateParentJob(raw: unknown) {
  const input = parentSchema.parse(raw);
  const principal = await getWebPrincipal();
  await setParentJob(principal, input);
  revalidatePath(`/jobs/${input.childJobId}`);
  if (input.parentJobId) revalidatePath(`/jobs/${input.parentJobId}`);
  revalidatePath("/bid-schedule");
}

const policySchema = z.object({
  groupId: z.number().int().positive(),
  role: z.enum(["pcm", "estimate_lead", "admin_jsa", "rpd"]),
  mode: z.enum(["direct", "propose", "read"]),
});

export async function saveGroupEditPolicy(raw: unknown) {
  const input = policySchema.parse(raw);
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "access", "manage", "Group edit policy");
  await setGroupEditPolicy(principal, input);
  revalidatePath("/admin");
  revalidatePath("/bid-schedule");
}
