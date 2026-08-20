"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { setRoundStaffAssignment } from "@/services/round-staffing-service";

const schema = z.object({
  roundId: z.number().int().positive(),
  stage: z.enum(["concept", "dd", "cd"]),
  userId: z.number().int().positive(),
  roleLabel: z.string().max(100).optional(),
  assigned: z.boolean(),
});

export async function updateRoundStaffAssignment(raw: unknown) {
  const input = schema.parse(raw);
  const principal = await getWebPrincipal();
  await setRoundStaffAssignment(principal, input);
  revalidatePath(`/rounds/${input.roundId}`);
  revalidatePath("/bid-schedule");
}
