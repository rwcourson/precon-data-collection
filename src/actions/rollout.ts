"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { ROUND_TABLE_FEATURES, type RolloutSettings } from "@/lib/rollout";
import { assertPrincipalAdmin } from "@/services/mutation-policy";
import { saveRolloutSettings } from "@/services/rollout-service";

const ROLES = [
  "pcm",
  "estimate_lead",
  "admin_jsa",
  "rpd",
  "leadership",
  "corporate_admin",
] as const;

const cohortSchema = z.object({
  enabled: z.boolean(),
  userIds: z.array(z.number().int().positive()).optional(),
  roles: z.array(z.enum(ROLES)).optional(),
  regions: z.array(z.string().min(1)).optional(),
});

const schema = z.object({
  version: z.literal(1),
  features: z.record(z.enum(ROUND_TABLE_FEATURES), cohortSchema),
});

export async function saveRoundtableRollout(raw: unknown) {
  const input = schema.parse(raw);
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "access", "manage", "Pilot configuration");
  const saved = await saveRolloutSettings(principal, input as RolloutSettings);
  revalidatePath("/admin");
  return saved;
}
