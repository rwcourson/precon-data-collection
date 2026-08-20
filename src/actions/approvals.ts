"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { approvalService } from "@/services/approval-service";

const decisionSchema = z.object({
  requestId: z.number().int().positive(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(500).optional(),
});

export async function decideApproval(raw: unknown) {
  const input = decisionSchema.parse(raw);
  const principal = await getWebPrincipal();
  const result = await approvalService.decide(
    principal,
    input.requestId,
    input.decision,
    input.reason
  );
  revalidatePath("/bid-schedule");
  revalidatePath("/post-bid");
  if ("roundId" in result && result.roundId)
    revalidatePath(`/rounds/${result.roundId}`);
  return result;
}
