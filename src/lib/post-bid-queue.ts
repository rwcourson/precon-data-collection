import type { EstimateRound } from "@/db/schema";
import { missingRequiredFields, requiredCompletion } from "@/lib/validation";

export type PostBidQueueState = "awaiting-required-fields" | "ready-to-lock";

export type PostBidQueueRow = {
  state: PostBidQueueState;
  missing: string[];
  done: number;
  total: number;
};

export function postBidQueueRow(
  round: EstimateRound,
  multiValues: Record<string, string[]>,
  extras: {
    jobNumber: string;
    jobName: string;
    estimateLeadName: string | null;
  }
): PostBidQueueRow {
  const missing = missingRequiredFields(round, multiValues, extras);
  const { done, total } = requiredCompletion(round, multiValues, extras);
  return {
    state: missing.length === 0 ? "ready-to-lock" : "awaiting-required-fields",
    missing,
    done,
    total,
  };
}
