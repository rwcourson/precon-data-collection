import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, estimateRounds } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadRoundForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import { requireAuthorized } from "@/services/mutation-policy";

async function loadMarkableRound(principal: Principal, roundId: number) {
  const readable = await loadRoundForPrincipal(principal, roundId, { capability: "read" });
  if (!readable) throw DomainError.notFound("Round not found");
  requireAuthorized(principal, "staffing.mark", readable.descriptor, "Staffing");
  return readable;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Explicit team-assigned mark — independent of estimateLeadId. */
export const staffingService = {
  async mark(principal: Principal, roundId: number) {
    const loaded = await loadMarkableRound(principal, roundId);
    const round = loaded.value.round;
    const now = new Date();
    const [updated] = await db
      .update(estimateRounds)
      .set({
        teamAssignedAt: now,
        teamAssignedById: principal.user.id,
        updatedAt: now,
      })
      .where(eq(estimateRounds.id, round.id))
      .returning();
    await db.insert(auditLog).values({
      entity: "round",
      entityId: round.id,
      roundId: round.id,
      action: "staffing.mark",
      field: "teamAssignedAt",
      oldValue: iso(round.teamAssignedAt),
      newValue: iso(updated.teamAssignedAt),
      userId: principal.user.id,
    });
    return updated;
  },

  async unmark(principal: Principal, roundId: number) {
    const loaded = await loadMarkableRound(principal, roundId);
    const round = loaded.value.round;
    if (round.teamAssignedAt == null && round.teamAssignedById == null) {
      return round;
    }
    const now = new Date();
    const [updated] = await db
      .update(estimateRounds)
      .set({
        teamAssignedAt: null,
        teamAssignedById: null,
        updatedAt: now,
      })
      .where(eq(estimateRounds.id, round.id))
      .returning();
    await db.insert(auditLog).values({
      entity: "round",
      entityId: round.id,
      roundId: round.id,
      action: "staffing.unmark",
      field: "teamAssignedAt",
      oldValue: iso(round.teamAssignedAt),
      newValue: null,
      userId: principal.user.id,
    });
    return updated;
  },
};
