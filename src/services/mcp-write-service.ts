import "server-only";
import { DomainError } from "@/domain/errors";
import { loadRoundForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import { notesService } from "@/services/notes-service";
import { pursuitService } from "@/services/pursuit-service";

/**
 * MCP-updatable round columns. No region moves, status, outcome, lock
 * timestamps, or estimate-lead assignment.
 */
export const MCP_PURSUIT_FIELD_ALLOWLIST = [
  "owner",
  "city",
  "state",
  "preconDepartment",
  "estimatePhase",
  "bidDueDate",
  "drawingsDueDate",
  "bidReviewDate",
  "projectStartDate",
  "mlt",
  "marketSector",
  "contractType",
  "procurement",
  "designContract",
  "statusAtPricing",
] as const;

export const MCP_PURSUIT_FIELD_ALLOWLIST_SET: ReadonlySet<string> = new Set(
  MCP_PURSUIT_FIELD_ALLOWLIST
);

const BLOCKED_FIELDS = new Set([
  "region",
  "status",
  "outcome",
  "lockedAt",
  "submittedAt",
  "estimateLead",
  "estimateLeadId",
]);

export async function appendNoteForMcp(
  principal: Principal,
  roundId: number,
  body: string
) {
  return notesService.create(principal, roundId, body);
}

export async function updatePursuitFieldsForMcp(
  principal: Principal,
  roundId: number,
  fields: Record<string, string>
) {
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    throw DomainError.badRequest("Provide at least one field to update.");
  }
  const rejected = keys.filter(
    (key) =>
      BLOCKED_FIELDS.has(key) || !MCP_PURSUIT_FIELD_ALLOWLIST_SET.has(key)
  );
  if (rejected.length > 0) {
    throw DomainError.badRequest(
      `Field(s) not allowed over MCP: ${rejected.join(", ")}. Allowed: ${MCP_PURSUIT_FIELD_ALLOWLIST.join(", ")}.`,
      "MCP cannot change status, outcome, region, lock, or other blocked fields."
    );
  }

  const loaded = await loadRoundForPrincipal(principal, roundId, {
    capability: "edit",
  });
  if (!loaded) throw DomainError.notFound("Round not found");
  if (loaded.value.round.status === "locked") {
    throw DomainError.forbidden(
      "Locked rounds cannot be updated over MCP.",
      "Post-lock corrections stay in the web app for RPD/SPD."
    );
  }

  return pursuitService.savePostBidData(principal, {
    roundId,
    values: fields,
    multiValues: {},
    customValues: {},
  });
}
