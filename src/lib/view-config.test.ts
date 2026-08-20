import { describe, expect, it } from "vitest";
import { parseBidScheduleViewConfig } from "@/lib/view-config";

describe("BidScheduleViewConfig v3", () => {
  it("loads a pre-v2 saved-view JSONB fixture without error and keeps prior behavior", () => {
    const legacy = {
      section: "upcoming",
      group: "preconDepartment",
      sort: "bidDueDate",
      dir: "asc" as const,
      region: "Florida",
      density: "summary" as const,
      columns: ["jobNumber", "jobName", "status"],
    };
    const parsed = parseBidScheduleViewConfig(legacy);
    expect(parsed.version).toBe(3);
    expect(parsed.section).toBe("upcoming");
    expect(parsed.group).toBe("preconDepartment");
    expect(parsed.region).toBe("Florida");
    expect(parsed.regions).toEqual(["Florida"]);
    expect(parsed.departments).toEqual([]);
    expect(parsed.columns).toEqual(["jobNumber", "jobName", "status"]);
  });

  it("falls back to defaults for garbage JSONB", () => {
    const parsed = parseBidScheduleViewConfig({ nope: true, columns: "bad" });
    expect(parsed.version).toBe(3);
    expect(parsed.regions).toEqual([]);
    expect(parsed.departments).toEqual([]);
    expect(parsed.columns).toBeUndefined();
  });

  it("keeps v2 regions and departments as written", () => {
    const parsed = parseBidScheduleViewConfig({
      version: 2,
      regions: ["Georgia"],
      departments: ["Central Building Group"],
    });
    expect(parsed.regions).toEqual(["Georgia"]);
    expect(parsed.departments).toEqual(["Central Building Group"]);
  });

  it("preserves a needs-staffing queue on a named view", () => {
    const parsed = parseBidScheduleViewConfig({
      version: 2,
      section: "upcoming",
      queue: "needs-staffing",
      regions: ["Central"],
    });
    expect(parsed.queue).toBe("needs-staffing");
    expect(parsed.section).toBe("upcoming");
    expect(parsed.regions).toEqual(["Central"]);
  });

  it("keeps a v3 viewMode", () => {
    const parsed = parseBidScheduleViewConfig({
      version: 3,
      viewMode: "gantt",
    });
    expect(parsed.viewMode).toBe("gantt");
  });
});
