"use server";

import { revalidatePath } from "next/cache";
import { markTeamAssignedSchema } from "@/domain/contracts";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { staffingService } from "@/services/staffing-service";

function revalidateStaffing(roundId: number) {
  revalidatePath("/");
  revalidatePath("/bid-schedule");
  revalidatePath(`/rounds/${roundId}`);
}

export async function setTeamAssigned(input: {
  roundId: number;
  assigned: boolean;
}) {
  const parsed = markTeamAssignedSchema.parse(input);
  const principal = await getWebPrincipal();
  const round = parsed.assigned
    ? await staffingService.mark(principal, parsed.roundId)
    : await staffingService.unmark(principal, parsed.roundId);
  revalidateStaffing(parsed.roundId);
  return {
    roundId: round.id,
    teamAssignedAt: round.teamAssignedAt?.toISOString() ?? null,
    teamAssignedById: round.teamAssignedById,
  };
}
