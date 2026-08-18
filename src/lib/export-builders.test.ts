import { describe, expect, it } from "vitest";
import { applyBidScheduleExportScope } from "./bid-schedule";
import { buildPrintHtml, buildWorkbook } from "./export-helpers";
import { STATUS_LABELS } from "./permissions";
import { resolveRegionParam, type Workspace } from "./workspace";

function workspace(region: string | null): Workspace {
  return {
    region,
    label: region ?? "Corporate",
    accent: "#000",
    available: region ? [region] : ["Central", "Florida"],
    canViewCorporate: region == null,
  };
}

describe("export builders and scope", () => {
  it("buildWorkbook writes a non-empty xlsx zip", async () => {
    const buffer = await buildWorkbook({
      title: "Estimate Summary",
      sheetName: "Rollup",
      columns: [
        { key: "group", label: "Region", type: "text" },
        { key: "volume", label: "Volume", type: "dollars" },
      ],
      rows: [
        { group: "Central", volume: 12_000_000 },
        { group: "Florida", volume: 8_000_000 },
      ],
    });
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("buildPrintHtml includes chosen columns and grouped rows", () => {
    const html = buildPrintHtml({
      title: "Bid Schedule",
      columns: [
        { key: "jobName", label: "Job", type: "text" },
        { key: "bidDueDate", label: "Bid due", type: "date" },
      ],
      rows: [
        { jobName: "Alpha", bidDueDate: "2026-08-01", region: "Central" },
        { jobName: "Bravo", bidDueDate: "2026-09-01", region: "Florida" },
      ],
      groupBy: ["region"],
      formatValue: (_key, value) => String(value ?? "—"),
    });
    expect(html).toContain("Bid Schedule");
    expect(html).toContain("Alpha");
    expect(html).toContain("Bravo");
    expect(html).toContain("Job");
  });

  it("applyBidScheduleExportScope honors section, columns-adjacent filters, and sort", () => {
    const rows = [
      {
        status: STATUS_LABELS.active,
        region: "Central",
        estimatePhase: "GMP",
        bidYear: 2026,
        jobName: "Zulu Hospital",
        jobNumber: "24101",
      },
      {
        status: STATUS_LABELS.active,
        region: "Florida",
        estimatePhase: "GMP",
        bidYear: 2026,
        jobName: "Alpha Tower",
        jobNumber: "24102",
      },
      {
        status: STATUS_LABELS.upcoming,
        region: "Central",
        estimatePhase: "Budget – SD",
        bidYear: 2027,
        jobName: "Later",
        jobNumber: "24103",
      },
    ];
    const activeCentral = applyBidScheduleExportScope(rows, {
      section: "active",
      region: "Central",
      sortBy: [{ field: "jobName", dir: "asc" }],
    });
    expect(activeCentral).toHaveLength(1);
    expect(activeCentral[0]!.jobName).toBe("Zulu Hospital");

    const named = applyBidScheduleExportScope(rows, { q: "alpha" });
    expect(named.map((r) => r.jobName)).toEqual(["Alpha Tower"]);

    const byYear = applyBidScheduleExportScope(rows, { year: "2027" });
    expect(byYear).toHaveLength(1);
    expect(byYear[0]!.jobNumber).toBe("24103");
  });

  it("resolveRegionParam is 403-shaped for a scoped workspace asking another region", () => {
    const scoped = resolveRegionParam(workspace("Central"), "Florida");
    expect("error" in scoped).toBe(true);
    if ("error" in scoped)
      expect(scoped.error).toMatch(/scoped to the Central workspace/);
    const own = resolveRegionParam(workspace("Central"), "Central");
    expect(own).toEqual({ region: "Central" });
    const corp = resolveRegionParam(workspace(null), "Florida");
    expect(corp).toEqual({ region: "Florida" });
  });
});
