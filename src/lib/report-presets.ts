import type { SavedReportConfig } from "@/db/schema";

export { weekPeriodKey } from "@/lib/distribution-schedule";

/** Consolidated regional bid schedule — all divisions in the active workspace. */
export const CONSOLIDATED_REGIONAL_PRESET_KEY = "consolidated_regional_bid_schedule";

export const CONSOLIDATED_REGIONAL_PRESET: {
  name: string;
  presetKey: string;
  config: SavedReportConfig;
} = {
  name: "Consolidated Regional Bid Schedule",
  presetKey: CONSOLIDATED_REGIONAL_PRESET_KEY,
  config: {
    fields: [
      "jobNumber",
      "jobName",
      "owner",
      "preconDepartment",
      "estimatePhase",
      "drawingsDueDate",
      "bidReviewDate",
      "bidDueDate",
      "procurement",
      "estimateLead",
      "status",
      "estimateValue",
    ],
    filters: [],
    groupBy: ["preconDepartment"],
    aggregations: [],
    sortBy: [
      { field: "preconDepartment", dir: "asc" },
      { field: "bidDueDate", dir: "asc" },
    ],
  },
};

/** Insert payload for seed + Smartsheet import — always the live preset config. */
export function consolidatedRegionalReportInsert(ownerId: number) {
  return {
    name: CONSOLIDATED_REGIONAL_PRESET.name,
    ownerId,
    presetKey: CONSOLIDATED_REGIONAL_PRESET.presetKey,
    config: CONSOLIDATED_REGIONAL_PRESET.config,
    sharedWithRegions: ["Central"],
  };
}
