import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { roundStaffAssignments } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadRoundForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";

export async function listRoundStaffAssignments(roundId: number) {
  return db
    .select()
    .from(roundStaffAssignments)
    .where(eq(roundStaffAssignments.roundId, roundId));
}

export async function setRoundStaffAssignment(
  principal: Principal,
  input: {
    roundId: number;
    stage: "concept" | "dd" | "cd";
    userId: number;
    roleLabel?: string;
    assigned: boolean;
  }
) {
  const loaded = await loadRoundForPrincipal(principal, input.roundId, {
    capability: "staffing.mark",
  });
  if (!loaded) throw DomainError.notFound("Round not found");
  if (!input.assigned) {
    await db
      .delete(roundStaffAssignments)
      .where(
        and(
          eq(roundStaffAssignments.roundId, input.roundId),
          eq(roundStaffAssignments.stage, input.stage),
          eq(roundStaffAssignments.userId, input.userId)
        )
      );
    return;
  }
  await db
    .insert(roundStaffAssignments)
    .values({
      roundId: input.roundId,
      stage: input.stage,
      userId: input.userId,
      roleLabel: input.roleLabel?.trim() || null,
      assignedById: principal.user.id,
    })
    .onConflictDoUpdate({
      target: [
        roundStaffAssignments.roundId,
        roundStaffAssignments.stage,
        roundStaffAssignments.userId,
      ],
      set: {
        roleLabel: input.roleLabel?.trim() || null,
        assignedById: principal.user.id,
        updatedAt: new Date(),
      },
    });
}
