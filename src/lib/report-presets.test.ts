import { describe, expect, it } from "vitest";
import { buildPrintHtml } from "./export-helpers";
import { buildFieldCatalog } from "./report-engine";
import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "@/db";
import { savedReports } from "@/db/schema";
import { LATEST_NOTE_KEY, LATEST_NOTE_LABEL } from "./latest-note";
import {
  CONSOLIDATED_REGIONAL_PRESET,
  CONSOLIDATED_REGIONAL_PRESET_KEY,
  consolidatedRegionalReportInsert,
  UPCOMING_BID_SCHEDULE_PRESET,
  UPCOMING_BID_SCHEDULE_PRESET_KEY,
  upcomingBidScheduleReportInsert,
} from "./report-presets";

describe("consolidated regional bid-schedule export", () => {
  it("includes Owner, Drawings Due, Bid Review, and Latest note rightmost", () => {
    expect(CONSOLIDATED_REGIONAL_PRESET.config.fields).toEqual(
      expect.arrayContaining(["owner", "drawingsDueDate", "bidReviewDate", "procurement"]),
    );
    expect(CONSOLIDATED_REGIONAL_PRESET.config.fields.at(-1)).toBe(LATEST_NOTE_KEY);
  });

  it("print HTML from the shipped builder carries those operational labels", () => {
    const catalog = buildFieldCatalog([]);
    const columns = CONSOLIDATED_REGIONAL_PRESET.config.fields.map((key) => {
      const def = catalog.find((c) => c.key === key);
      return { key, label: def?.label ?? key, type: def?.type ?? "text" };
    });
    const html = buildPrintHtml({
      title: "Consolidated Regional Bid Schedule",
      columns,
      rows: [
        {
          jobNumber: "24150",
          jobName: "St. Thomas Midtown Expansion",
          owner: "HCA Healthcare",
          preconDepartment: "Central Building Group",
          drawingsDueDate: "2026-03-15",
          bidReviewDate: "2026-04-01",
          bidDueDate: "2026-04-15",
          [LATEST_NOTE_KEY]: "Jay McDaniel · Aug 12, 2026 — Drawings slipped a week.",
        },
      ],
      formatValue: (_key, value) => String(value ?? ""),
      groupBy: ["preconDepartment"],
    });
    expect(html).toContain("Owner");
    expect(html).toContain("Drawings Due");
    expect(html).toContain("Bid Review");
    expect(html).toContain(LATEST_NOTE_LABEL);
    expect(html).toContain("HCA Healthcare");
    expect(html).toContain("2026-03-15");
    expect(html).toContain("overflow-wrap: anywhere");
    expect(html).toContain("break-inside: avoid");
  });

  it("seed insert payload is the live preset, not a stale column list", () => {
    const row = consolidatedRegionalReportInsert(7);
    expect(row.presetKey).toBe(CONSOLIDATED_REGIONAL_PRESET_KEY);
    expect(row.config).toBe(CONSOLIDATED_REGIONAL_PRESET.config);
    expect(row.config.fields).toEqual(
      expect.arrayContaining(["owner", "drawingsDueDate", "bidReviewDate", LATEST_NOTE_KEY]),
    );
  });

  it("demo seed persists that live preset on the named saved report", async () => {
    await ensureDbReady();
    const [row] = await db
      .select()
      .from(savedReports)
      .where(eq(savedReports.presetKey, CONSOLIDATED_REGIONAL_PRESET_KEY));
    expect(row).toBeTruthy();
    expect(row.config.fields).toEqual(CONSOLIDATED_REGIONAL_PRESET.config.fields);
    expect(row.config.fields).toEqual(
      expect.arrayContaining(["owner", "drawingsDueDate", "bidReviewDate", LATEST_NOTE_KEY]),
    );
  });
});

describe("upcoming bid-schedule preset", () => {
  it("filters Upcoming and puts Latest note rightmost without grouping", () => {
    expect(UPCOMING_BID_SCHEDULE_PRESET.config.fields.at(-1)).toBe(LATEST_NOTE_KEY);
    expect(UPCOMING_BID_SCHEDULE_PRESET.config.groupBy).toEqual([]);
    expect(UPCOMING_BID_SCHEDULE_PRESET.config.filters).toEqual([
      { field: "status", op: "eq", value: "Upcoming" },
    ]);
  });

  it("demo seed persists the upcoming preset", async () => {
    await ensureDbReady();
    const insert = upcomingBidScheduleReportInsert(7);
    expect(insert.presetKey).toBe(UPCOMING_BID_SCHEDULE_PRESET_KEY);
    const [row] = await db
      .select()
      .from(savedReports)
      .where(eq(savedReports.presetKey, UPCOMING_BID_SCHEDULE_PRESET_KEY));
    expect(row).toBeTruthy();
    expect(row.config.fields).toEqual(UPCOMING_BID_SCHEDULE_PRESET.config.fields);
  });
});
