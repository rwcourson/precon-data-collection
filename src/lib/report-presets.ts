import type { SavedReportConfig } from "@/db/schema";
import { LATEST_NOTE_KEY } from "@/lib/latest-note";

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
      LATEST_NOTE_KEY,
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

/** Upcoming efforts with the latest note beside each row (detail, not grouped). */
export const UPCOMING_BID_SCHEDULE_PRESET_KEY = "upcoming_bid_schedule";

export const UPCOMING_BID_SCHEDULE_PRESET: {
  name: string;
  presetKey: string;
  config: SavedReportConfig;
} = {
  name: "Upcoming Bid Schedule",
  presetKey: UPCOMING_BID_SCHEDULE_PRESET_KEY,
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
      LATEST_NOTE_KEY,
    ],
    filters: [{ field: "status", op: "eq", value: "Upcoming" }],
    groupBy: [],
    aggregations: [],
    sortBy: [{ field: "bidDueDate", dir: "asc" }],
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

export function upcomingBidScheduleReportInsert(ownerId: number) {
  return {
    name: UPCOMING_BID_SCHEDULE_PRESET.name,
    ownerId,
    presetKey: UPCOMING_BID_SCHEDULE_PRESET.presetKey,
    config: UPCOMING_BID_SCHEDULE_PRESET.config,
    sharedWithRegions: ["Central"],
  };
}
