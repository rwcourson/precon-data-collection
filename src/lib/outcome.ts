import type { EstimateRound, User } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { authorize } from "@/lib/authorization/kernel";
import { createPrincipal } from "@/lib/authorization/principal";

export type OutcomeValue = "pending" | "successful" | "unsuccessful";

export type OutcomeAuditEntry = {
  entity: "round";
  entityId: number;
  roundId: number;
  action: "field_changed";
  field: "outcome";
  oldValue: string;
  newValue: string;
};

/**
 * Locked revisions are immutable; updates happen after an explicit unlock and
 * every actual change produces an audit row.
 */
export function planOutcomeUpdate(
  user: User,
  round: Pick<EstimateRound, "id" | "status" | "region" | "outcome">,
  outcome: OutcomeValue,
  options: { lockImmutable?: boolean } = {}
): { audit: OutcomeAuditEntry | null } {
  const principal = createPrincipal({
    user,
    authSource: "service",
    workspaceRegion: user.region,
  });
  if (round.status === "locked" && options.lockImmutable) {
    throw DomainError.forbidden(
      "Record is locked — send it back before updating the outcome",
      "Locked revisions are immutable; an RPD/SPD must explicitly unlock it."
    );
  }
  const canEdit = authorize(principal, "edit", {
    type: "round",
    id: round.id,
    region: round.region,
    ownerId: null,
    published: true,
    deleted: false,
    round: { status: round.status, region: round.region },
    fieldKey: "outcome",
    lockImmutable: options.lockImmutable,
  }).allowed;
  if (!canEdit) throw DomainError.forbidden("Not permitted to update outcome");

  if (round.outcome === outcome) {
    return { audit: null };
  }

  return {
    audit: {
      entity: "round",
      entityId: round.id,
      roundId: round.id,
      action: "field_changed",
      field: "outcome",
      oldValue: round.outcome,
      newValue: outcome,
    },
  };
}
