import { describe, expect, it } from "vitest";
import { buildPrintHtml } from "./export-helpers";
import { FIELD_MAP } from "./fields";
import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "@/db";
import { savedReports } from "@/db/schema";
import {
  CONSOLIDATED_REGIONAL_PRESET,
  CONSOLIDATED_REGIONAL_PRESET_KEY,
  consolidatedRegionalReportInsert,
} from "./report-presets";

describe("consolidated regional bid-schedule export", () => {
  it("includes Owner, Drawings Due, and Bid Review in the shipped preset", () => {
    expect(CONSOLIDATED_REGIONAL_PRESET.config.fields).toEqual(
      expect.arrayContaining(["owner", "drawingsDueDate", "bidReviewDate", "procurement"]),
    );
  });

  it("print HTML from the shipped builder carries those operational labels", () => {
    const columns = CONSOLIDATED_REGIONAL_PRESET.config.fields.map((key) => ({
      key,
      label: FIELD_MAP[key]?.label ?? key,
      type: FIELD_MAP[key]?.type ?? "text",
    }));
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
        },
      ],
      formatValue: (_key, value) => String(value ?? ""),
      groupBy: ["preconDepartment"],
    });
    expect(html).toContain("Owner");
    expect(html).toContain("Drawings Due");
    expect(html).toContain("Bid Review");
    expect(html).toContain("HCA Healthcare");
    expect(html).toContain("2026-03-15");
  });

  it("seed insert payload is the live preset, not a stale column list", () => {
    const row = consolidatedRegionalReportInsert(7);
    expect(row.presetKey).toBe(CONSOLIDATED_REGIONAL_PRESET_KEY);
    expect(row.config).toBe(CONSOLIDATED_REGIONAL_PRESET.config);
    expect(row.config.fields).toEqual(
      expect.arrayContaining(["owner", "drawingsDueDate", "bidReviewDate"]),
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
      expect.arrayContaining(["owner", "drawingsDueDate", "bidReviewDate"]),
    );
  });
});
