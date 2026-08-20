export const PRODUCT_NAME = "B&G Precon — Pursuits & Data";
export const PRODUCT_SHORT_NAME = "B&G Precon";
export const PRODUCT_TAGLINE = "Pursuits & Data";
export const PRODUCT_DESCRIPTION =
  "Preconstruction pursuit scheduling and post-bid data";

/** Estimate value at or above this amount suggests HPP; it never auto-sets the flag. */
export const HPP_SUGGEST_THRESHOLD = Number(
  process.env.HPP_SUGGEST_THRESHOLD ?? 200_000_000
);

export function suggestHppFromEstimateValue(
  estimateValue: number | null | undefined,
  threshold = HPP_SUGGEST_THRESHOLD
): boolean {
  return (estimateValue ?? 0) >= threshold;
}
