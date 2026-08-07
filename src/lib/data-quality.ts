import type { EstimateRound, Job } from "@/db/schema";
import { FIELD_MAP, MULTI_FIELD_KEYS } from "./fields";
import { applicableRequiredKeys } from "./validation";

/**
 * Import remediation (BRD Section 17). Legacy SmartSheet years arrive with
 * blanks and free-text values that never matched a managed list. Nothing is
 * rewritten on import — the original text is preserved and surfaced here so a
 * human decides whether it is a real value, a typo, or a list gap.
 */

export type FlagKind = "missing_required" | "unknown_list_value" | "unlinked_job";

export const FLAG_LABELS: Record<FlagKind, string> = {
  missing_required: "Missing required value",
  unknown_list_value: "Not in managed list",
  unlinked_job: "Job not linked to Connect",
};

export type ScannedFlag = {
  roundId: number;
  field: string;
  kind: FlagKind;
  value: string | null;
};

/**
 * Flags one round. Required-field blanks only count once a round has reached
 * post-bid — an Upcoming pursuit is legitimately incomplete.
 */
export function scanRound(
  round: EstimateRound,
  job: Job,
  multi: Record<string, string[]>,
  lists: Record<string, string[]>,
): ScannedFlag[] {
  const flags: ScannedFlag[] = [];
  const expectComplete = ["submitted", "post_bid", "locked"].includes(round.status);
  const record = round as unknown as Record<string, unknown>;

  for (const key of applicableRequiredKeys(round)) {
    if (!expectComplete) break;
    if (["jobNumber", "jobName", "estimateLead"].includes(key)) continue;
    if (MULTI_FIELD_KEYS.includes(key)) {
      if ((multi[key] ?? []).length === 0)
        flags.push({ roundId: round.id, field: key, kind: "missing_required", value: null });
      continue;
    }
    const v = record[key];
    if (v === null || v === undefined || v === "")
      flags.push({ roundId: round.id, field: key, kind: "missing_required", value: null });
  }

  // Dropdown values that do not match the managed list — kept, not coerced.
  for (const def of Object.values(FIELD_MAP)) {
    if (def.type !== "dropdown" && def.type !== "multi") continue;
    const allowed = def.listKey ? lists[def.listKey] : undefined;
    if (!allowed || allowed.length === 0) continue;

    const values =
      def.type === "multi" ? (multi[def.key] ?? []) : [record[def.key]].filter(Boolean);
    for (const raw of values) {
      const value = String(raw);
      if (value === "" || allowed.includes(value)) continue;
      flags.push({ roundId: round.id, field: def.key, kind: "unknown_list_value", value });
    }
  }

  if (!job.isLinked) {
    flags.push({
      roundId: round.id,
      field: "jobNumber",
      kind: "unlinked_job",
      value: job.jobNumber,
    });
  }

  return flags;
}

/** Stable identity for a flag so rescans update rather than duplicate. */
export const flagKey = (f: { roundId: number; field: string; kind: string; value: string | null }) =>
  `${f.roundId}\u241F${f.field}\u241F${f.kind}\u241F${f.value ?? ""}`;

export function fieldLabel(field: string): string {
  return FIELD_MAP[field]?.label ?? field;
}
