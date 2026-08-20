"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { setFieldException } from "@/services/field-exceptions-service";

const schema = z.object({
  roundId: z.number().int().positive(),
  fieldKey: z.string().min(1).max(100),
  kind: z.enum(["not_applicable", "range_acknowledgement"]),
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

export async function updateFieldException(raw: unknown) {
  const input = schema.parse(raw);
  const principal = await getWebPrincipal();
  await setFieldException(principal, input);
  revalidatePath(`/rounds/${input.roundId}`);
  revalidatePath("/post-bid");
  return { ok: true };
}
