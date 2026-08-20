"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { unlockRound } from "@/services/lock-lifecycle-service";

const unlockSchema = z.object({
  roundId: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});

export async function unlockRoundAction(raw: unknown) {
  const input = unlockSchema.parse(raw);
  const principal = await getWebPrincipal();
  const result = await unlockRound(principal, input.roundId, input.reason);
  revalidatePath(`/rounds/${input.roundId}`);
  revalidatePath("/post-bid");
  revalidatePath("/dashboards");
  return result;
}
