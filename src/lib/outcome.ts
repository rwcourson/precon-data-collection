import { DomainError } from "@/domain/errors";
import { authorize } from "@/lib/authorization/kernel";
import { createPrincipal } from "@/lib/authorization/principal";
import type { EstimateRound, User } from "@/db/schema";

export type OutcomeValue = "pending" | "successful" | "unsuccessful";

export type OutcomeAuditEntry = {
  entity: "round";
  entityId: number;
  roundId: number;
  action: "post_lock_edit";
  field: "outcome";
  oldValue: string;
  newValue: string;
};

/**
 * Permission gate for outcome updates. Post-lock corrections are RPD/SPD only
 * and must produce an audit row when the value actually changes.
 */
export function planOutcomeUpdate(
  user: User,
  round: Pick<EstimateRound, "id" | "status" | "region" | "outcome">,
  outcome: OutcomeValue,
): { audit: OutcomeAuditEntry | null } {
  const principal = createPrincipal({
    user,
    authSource: "service",
    workspaceRegion: user.region,
  });
  const canCorrect = authorize(principal, "edit", {
    type: "round",
    id: round.id,
    region: round.region,
    ownerId: null,
    published: true,
    deleted: false,
    round: { status: round.status, region: round.region },
    fieldKey: "outcome",
  }).allowed;
  if (round.status === "locked" && !canCorrect) {
    throw DomainError.forbidden(
      "Record is locked — only the RPD/SPD can update the outcome",
      "Post-lock outcome corrections are limited to the regional RPD/SPD.",
    );
  }

  if (round.status !== "locked" || round.outcome === outcome) {
    return { audit: null };
  }

  return {
    audit: {
      entity: "round",
      entityId: round.id,
      roundId: round.id,
      action: "post_lock_edit",
      field: "outcome",
      oldValue: round.outcome,
      newValue: outcome,
    },
  };
}
