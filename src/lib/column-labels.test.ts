import { describe, expect, it } from "vitest";
import {
  columnDisplayLabel,
  formatColumnValue,
  humanizeFieldKey,
  tableColumnKeys,
} from "@/lib/column-labels";

describe("column display labels", () => {
  it("uses product names instead of raw keys", () => {
    expect(columnDisplayLabel("roundId")).toBe("Round ID");
    expect(columnDisplayLabel("jobId")).toBe("Job ID");
    expect(columnDisplayLabel("jobNumber")).toBe("Job Number");
    expect(columnDisplayLabel("jobName")).toBe("Job Name");
    expect(columnDisplayLabel("status")).toBe("Status");
    expect(columnDisplayLabel("homeRegion")).toBe("Home Region");
    expect(columnDisplayLabel("estimatePhase")).toBe("Estimate Phase");
  });

  it("title-cases unknown camelCase keys", () => {
    expect(humanizeFieldKey("visibilityRegions")).toBe("Visibility Regions");
    expect(humanizeFieldKey("bid_due_date")).toBe("Bid Due Date");
  });

  it("puts named fields ahead of raw ids", () => {
    expect(
      tableColumnKeys({
        roundId: 132,
        jobId: 51,
        jobNumber: "21757",
        jobName: "UAB St. Vincent’s Pelham",
        status: "outstanding",
        homeRegion: "Central",
      }),
    ).toEqual(["jobNumber", "jobName", "status", "homeRegion"]);
  });

  it("formats status enums for the grid", () => {
    expect(formatColumnValue("status", "outstanding")).toBe("Outstanding");
    expect(formatColumnValue("jobName", "UAB St. Vincent’s Pelham")).toBe(
      "UAB St. Vincent’s Pelham",
    );
  });
});
