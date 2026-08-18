import { describe, expect, it } from "vitest";
import {
  assertGridAligned,
  buildSheetGridMatrix,
  canShowSheetArchive,
  cellDisplay,
  dueBandLabel,
  dueDateBand,
  filterSheetsByQuery,
  formatCompactDollars,
  formatDueDateHuman,
  formatKpiValue,
  groupRowsByDueBand,
  groupSheetsByFolder,
  parseRouteFlag,
  sheetColumnWidth,
  sheetDisplayName,
  sheetListSubtitle,
  sheetSortRank,
  sortSheetsForList,
} from "@/lib/mobile-data-display";

describe("mobile-data-display (shipped helpers)", () => {
  it("formatCompactDollars scales pipeline values", () => {
    expect(formatCompactDollars(null)).toBe("—");
    expect(formatCompactDollars(1_200_000_000)).toBe("$1.2B");
    expect(formatCompactDollars(45_000_000)).toBe("$45.0M");
    expect(formatCompactDollars(2500)).toBe("$3K");
  });

  it("formatKpiValue handles dollars, percent ratios, and counts", () => {
    expect(formatKpiValue(null, "dollars")).toBe("—");
    expect(formatKpiValue(12_500_000, "dollars")).toBe("$12.5M");
    expect(formatKpiValue(0.61, "percent")).toBe("61.0%");
    expect(formatKpiValue(87, "number")).toBe("87");
  });

  it("cellDisplay shows em dash for empty cells", () => {
    expect(cellDisplay(null)).toBe("—");
    expect(cellDisplay("  ")).toBe("—");
    expect(cellDisplay("Central")).toBe("Central");
  });

  it("sheetColumnWidth grows with label length within bounds", () => {
    const short = sheetColumnWidth("ID");
    const long = sheetColumnWidth("Preconstruction Department Name");
    expect(short).toBeGreaterThanOrEqual(96);
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThanOrEqual(200);
  });

  it("dueDateBand buckets relative to a fixed now", () => {
    const now = new Date(2026, 7, 8); // Aug 8 2026 local
    expect(dueDateBand("2026-08-01", now)).toBe("overdue");
    expect(dueDateBand("2026-08-10", now)).toBe("this_week");
    expect(dueDateBand("2026-08-18", now)).toBe("next_week");
    expect(dueDateBand("2026-09-01", now)).toBe("later");
    expect(dueDateBand(null, now)).toBe("none");
    expect(dueBandLabel("overdue")).toBe("Overdue");
  });

  it("formatDueDateHuman is scannable", () => {
    expect(formatDueDateHuman(null)).toBe("No due date");
    expect(formatDueDateHuman("2026-09-15")).toMatch(/Sep/);
    expect(formatDueDateHuman("2026-09-15")).toMatch(/15/);
  });

  it("groupRowsByDueBand omits empty bands and sorts soonest first", () => {
    const now = new Date(2026, 7, 8);
    const groups = groupRowsByDueBand(
      [
        { id: 1, bidDueDate: "2026-09-20" },
        { id: 2, bidDueDate: "2026-08-05" },
        { id: 3, bidDueDate: "2026-08-09" },
        { id: 4, bidDueDate: null },
      ],
      now
    );
    expect(groups.map((g) => g.band)).toEqual([
      "overdue",
      "this_week",
      "later",
      "none",
    ]);
    expect(groups[0].rows[0].id).toBe(2);
    expect(groups.find((g) => g.band === "none")?.rows).toHaveLength(1);
  });

  it("buildSheetGridMatrix maps live columns/rows to header+body cells", () => {
    const matrix = buildSheetGridMatrix(
      [
        { key: "jobName", label: "Job Name" },
        { key: "region", label: "Region" },
      ],
      [
        {
          id: 10,
          values: { jobName: "UNC Rex", region: "Carolinas" },
        },
        {
          id: 11,
          values: { jobName: null, region: "  " },
        },
      ]
    );
    expect(matrix.headers).toEqual(["Job Name", "Region"]);
    expect(matrix.keys).toEqual(["jobName", "region"]);
    expect(matrix.body).toHaveLength(2);
    expect(matrix.body[0].cells).toEqual(["UNC Rex", "Carolinas"]);
    expect(matrix.body[1].cells).toEqual(["—", "—"]);
    expect(matrix.widths).toHaveLength(2);
    // Multi-column contract: every row cell count matches headers (not vertical stack of labels)
    expect(assertGridAligned(matrix)).toBe(true);
    expect(
      matrix.body.every((r) => r.cells.length === matrix.headers.length)
    ).toBe(true);
  });

  it("assertGridAligned rejects mis-sized rows", () => {
    expect(
      assertGridAligned({
        headers: ["A", "B"],
        body: [{ cells: ["1"] }],
      })
    ).toBe(false);
  });

  it("sheetDisplayName humanizes pcn_* and snake_case keys", () => {
    expect(sheetDisplayName("pcn_bid_schedule")).toBe("Bid Schedule");
    expect(sheetDisplayName("pcn_gmp_history")).toBe("GMP History");
    expect(sheetDisplayName("pcn_sub_rates")).toBe("Subcontractor Rates");
    expect(sheetDisplayName("labor_rate_history")).toBe("Labor Rate History");
    expect(sheetDisplayName("Weekly Region Bid Schedule")).toBe(
      "Weekly Region Bid Schedule"
    );
    expect(sheetDisplayName("")).toBe("Untitled sheet");
  });

  it("sortSheetsForList ranks core workflow before rates and pins first", () => {
    const sorted = sortSheetsForList([
      { id: 1, name: "pcn_unit_prices", folder: "Rates", pinned: false },
      { id: 2, name: "pcn_bid_schedule", folder: "Core", pinned: false },
      { id: 3, name: "pcn_contacts", folder: "Core", pinned: true },
      { id: 4, name: "pcn_post_bid", folder: "Core", pinned: false },
    ]);
    expect(sorted.map((s) => s.id)).toEqual([3, 2, 4, 1]);
    expect(sheetSortRank("pcn_bid_schedule")).toBeLessThan(
      sheetSortRank("pcn_labor_rates")
    );
  });

  it("groupSheetsByFolder keeps sort and sections folders", () => {
    const groups = groupSheetsByFolder([
      { id: 1, name: "pcn_bid_schedule", folder: null },
      { id: 2, name: "pcn_labor_rates", folder: "Rates" },
      { id: 3, name: "pcn_post_bid", folder: "" },
    ]);
    expect(groups[0].folder).toBe("General");
    expect(groups[0].sheets.map((s) => s.id)).toEqual([1, 3]);
    expect(groups[1].folder).toBe("Rates");
  });

  it("filterSheetsByQuery matches display names", () => {
    const rows = [
      { id: 1, name: "pcn_bid_schedule", folder: "Core" },
      { id: 2, name: "pcn_labor_rates", folder: "Rates" },
    ];
    expect(filterSheetsByQuery(rows, "bid").map((s) => s.id)).toEqual([1]);
    expect(filterSheetsByQuery(rows, "rates").map((s) => s.id)).toEqual([2]);
  });

  it("sheetListSubtitle is scannable without raw dashes alone", () => {
    expect(
      sheetListSubtitle({
        folder: null,
        kind: "grid",
        rowCount: 12,
        pinned: true,
      })
    ).toBe("General · Grid · 12 rows · Pinned");
  });

  it("parseRouteFlag hydrates list→detail pin/canManage query params", () => {
    expect(parseRouteFlag("1")).toBe(true);
    expect(parseRouteFlag("true")).toBe(true);
    expect(parseRouteFlag("yes")).toBe(true);
    expect(parseRouteFlag(["1"])).toBe(true);
    expect(parseRouteFlag("0")).toBe(false);
    expect(parseRouteFlag("false")).toBe(false);
    expect(parseRouteFlag(undefined)).toBe(false);
    expect(parseRouteFlag("")).toBe(false);
  });

  it("canShowSheetArchive matches list/web canManage gate", () => {
    expect(canShowSheetArchive(true)).toBe(true);
    expect(canShowSheetArchive(false)).toBe(false);
    expect(canShowSheetArchive(null)).toBe(false);
    expect(canShowSheetArchive(undefined)).toBe(false);
  });
});
