import { describe, expect, it } from "vitest";
import { applyBidScheduleExportScope } from "./bid-schedule";
import {
  buildPrintHtml,
  buildWorkbook,
  formatExportCell,
} from "./export-helpers";
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
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0]!;
    expect(ws.views?.[0]).toMatchObject({ state: "frozen", ySplit: 2 });
    expect(ws.autoFilter).toBeTruthy();
  });

  it("formatExportCell prints dollars and percent for PDF tables", () => {
    expect(formatExportCell("dollars", 1200000)).toBe("$1,200,000");
    expect(formatExportCell("percent", 0.625)).toBe("62.5%");
    expect(formatExportCell("number", 12)).toBe("12");
    expect(formatExportCell("text", null)).toBe("—");
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
    expect(html).toContain('class="brand"');
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

  it("applyBidScheduleExportScope honors queues and hides nested children", () => {
    const rows = [
      {
        status: STATUS_LABELS.active,
        region: "Central",
        jobName: "Overdue",
        jobNumber: "24101",
        jobId: 1,
        bidDueDate: "2026-01-01",
        isLinked: 1,
        teamAssignedAt: null,
      },
      {
        status: STATUS_LABELS.active,
        region: "Central",
        jobName: "Child TI",
        jobNumber: "24101-TI",
        jobId: 2,
        bidDueDate: "2026-01-01",
        isLinked: 1,
        teamAssignedAt: null,
      },
      {
        status: STATUS_LABELS.upcoming,
        region: "Central",
        jobName: "Unlinked",
        jobNumber: "TBD-9",
        jobId: 3,
        bidDueDate: null,
        isLinked: 0,
        teamAssignedAt: null,
      },
    ];
    const pastDue = applyBidScheduleExportScope(rows, {
      queue: "past-due",
      today: "2026-08-01",
    });
    expect(pastDue.map((row) => row.jobName)).toEqual(["Overdue", "Child TI"]);
    const withoutChildren = applyBidScheduleExportScope(rows, {
      queue: "past-due",
      today: "2026-08-01",
      childJobIds: [2],
    });
    expect(withoutChildren.map((row) => row.jobName)).toEqual(["Overdue"]);
    expect(
      applyBidScheduleExportScope(rows, { queue: "unlinked" }).map(
        (row) => row.jobName
      )
    ).toEqual(["Unlinked"]);
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
