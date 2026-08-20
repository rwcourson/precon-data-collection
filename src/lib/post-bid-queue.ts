import type { EstimateRound } from "@/db/schema";
import { missingRequiredFields, requiredCompletion } from "@/lib/validation";

export type PostBidQueueState = "awaiting-required-fields" | "ready-to-lock";

export type PostBidQueueRow = {
  state: PostBidQueueState;
  missing: string[];
  done: number;
  total: number;
};

/** Estimate leads default to their owed queue; anyone can opt in with mine=1. */
export function postBidShowsMineOnly(
  role: string,
  mineParam: string | undefined
): boolean {
  return mineParam === "1" || (role === "estimate_lead" && mineParam !== "0");
}

export function postBidQueueRow(
  round: EstimateRound,
  multiValues: Record<string, string[]>,
  extras: {
    jobNumber: string;
    jobName: string;
    estimateLeadName: string | null;
  },
  options: { fieldPolicy?: boolean } = {}
): PostBidQueueRow {
  const missing = missingRequiredFields(
    round,
    multiValues,
    extras,
    {},
    options
  );
  const { done, total } = requiredCompletion(
    round,
    multiValues,
    extras,
    {},
    options
  );
  return {
    state: missing.length === 0 ? "ready-to-lock" : "awaiting-required-fields",
    missing,
    done,
    total,
  };
}
