"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  acknowledgeRoundChanges,
  acknowledgeVisibleChanges,
} from "@/services/change-awareness-service";

const schema = z.object({
  roundId: z.number().int().positive(),
  throughAuditId: z.number().int().positive(),
});

export async function acknowledgeChanges(raw: unknown) {
  const input = schema.parse(raw);
  const principal = await getWebPrincipal();
  await acknowledgeRoundChanges(principal, input.roundId, input.throughAuditId);
  revalidatePath("/bid-schedule");
  revalidatePath(`/rounds/${input.roundId}`);
}

const visibleSchema = z.object({
  items: z
    .array(
      z.object({
        roundId: z.number().int().positive(),
        throughAuditId: z.number().int().positive(),
      })
    )
    .max(200),
});

export async function acknowledgeVisibleScheduleChanges(raw: unknown) {
  const input = visibleSchema.parse(raw);
  const principal = await getWebPrincipal();
  await acknowledgeVisibleChanges(principal, input.items);
  revalidatePath("/bid-schedule");
}
