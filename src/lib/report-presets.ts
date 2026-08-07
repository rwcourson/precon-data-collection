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
      "preconDepartment",
      "estimatePhase",
      "bidDueDate",
      "marketSector",
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
