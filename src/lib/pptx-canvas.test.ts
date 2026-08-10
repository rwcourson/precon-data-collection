import { describe, expect, it } from "vitest";
import { buildCanvasPptx, summarizeWidgetsForPptx } from "@/lib/pptx-canvas";
import type { WidgetResolved } from "@/lib/dashboard-query";
import { planDashboardFromPrompt } from "@/lib/dashboard-copilot";
import { resolveWidgets } from "@/lib/dashboard-query";
import type { EstimateRound } from "@/db/schema";

function fixtureRounds(): EstimateRound[] {
  const base = {
    bidDueDate: null,
    createdById: 1,
    createdAt: new Date(),
    deletedAt: null,
    deletedById: null,
    updatedAt: new Date(),
  };
  return [
    {
      ...base,
      id: 1,
      jobId: 1,
      region: "Florida",
      status: "active",
      outcome: "pending",
      estimateValue: 50_000_000,
      bidYear: 2025,
      feeExpected: 1_500_000,
      feeExpectedPct: 0.03,
      contingencyTotal: 500_000,
      preconDepartment: "Florida",
      marketSector: "Healthcare",
      estimatePhase: "Schematic",
    },
    {
      ...base,
      id: 2,
      jobId: 2,
      region: "Central",
      status: "locked",
      outcome: "successful",
      estimateValue: 120_000_000,
      bidYear: 2025,
      feeExpected: 3_000_000,
      feeExpectedPct: 0.025,
      contingencyTotal: 1_000_000,
      preconDepartment: "Central Building Group",
      marketSector: "Industrial",
      estimatePhase: "DD",
    },
    {
      ...base,
      id: 3,
      jobId: 3,
      region: "Texas",
      status: "submitted",
      outcome: "unsuccessful",
      estimateValue: 80_000_000,
      bidYear: 2026,
      feeExpected: 2_000_000,
      feeExpectedPct: 0.025,
      contingencyTotal: 800_000,
      preconDepartment: "Texas",
      marketSector: "Commercial",
      estimatePhase: "CD",
    },
    {
      ...base,
      id: 4,
      jobId: 4,
      region: "Florida",
      status: "post_bid",
      outcome: "successful",
      estimateValue: 30_000_000,
      bidYear: 2026,
      feeExpected: 900_000,
      feeExpectedPct: 0.03,
      contingencyTotal: 300_000,
      preconDepartment: "Florida",
      marketSector: "Healthcare",
      estimatePhase: "Schematic",
    },
  ] as unknown as EstimateRound[];
}

function fixtureCanvas(): WidgetResolved[] {
  const plan = planDashboardFromPrompt("executive region scorecard");
  return resolveWidgets(plan.widgets, fixtureRounds());
}

describe("buildCanvasPptx", () => {
  it("builds multi-slide deck from resolved canvas widgets with real numbers", async () => {
    const widgets = fixtureCanvas();
    expect(widgets.some((w) => w.config.kind === "kpi")).toBe(true);
    expect(widgets.some((w) => w.config.kind !== "kpi")).toBe(true);

    const summary = summarizeWidgetsForPptx(widgets);
    expect(summary.kpis + summary.charts + summary.tables).toBeGreaterThanOrEqual(3);

    const { buffer, filename, slideCount } = await buildCanvasPptx({
      planName: "Executive region scorecard",
      planDescription: "Fixture canvas for PPTX export",
      widgets,
      scopeLabel: "Corporate",
    });

    expect(filename.endsWith(".pptx")).toBe(true);
    expect(filename.toLowerCase()).toContain("executive");
    expect(slideCount).toBeGreaterThanOrEqual(2);
    expect(buffer.length).toBeGreaterThan(1024);
    // ZIP magic (pptx is a zip)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("still produces ≥2 slides for empty widgets", async () => {
    const { buffer, slideCount } = await buildCanvasPptx({
      planName: "Empty canvas",
      widgets: [],
    });
    expect(slideCount).toBeGreaterThanOrEqual(2);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("formats Estimate rounds as counts in table slides (not $N)", async () => {
    const widgets = fixtureCanvas();
    const table = widgets.find((w) => w.config.kind === "table" && w.table);
    expect(table?.table?.columns).toContain("Estimate rounds");
    const rounds = table!.table!.rows.map((r) => r["Estimate rounds"]);
    expect(rounds.every((n) => typeof n === "number" && n >= 1)).toBe(true);

    // Pure formatter path used by PPTX builder
    const { formatTableCell } = await import("@/components/dashboards/chart-format");
    for (const n of rounds) {
      const cell = formatTableCell("Estimate rounds", n as number);
      expect(String(cell)).not.toMatch(/^\$/);
      expect(String(cell)).toBe(String(n));
    }

    const { buffer } = await buildCanvasPptx({
      planName: "Table format check",
      widgets,
    });
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = Object.keys(zip.files).filter((n) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(n),
    );
    const texts: string[] = [];
    for (const name of slideXml) {
      const xml = await zip.file(name)!.async("string");
      // Extract simple text runs; PPTX stores cell text in a:t
      for (const m of xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)) {
        texts.push(m[1]!);
      }
    }
    expect(texts.some((t) => t.includes("Estimate rounds"))).toBe(true);
    // Dollar-prefixed single-digit counts like $1/$2 must not appear for rounds
    const dollarCounts = texts.filter((t) => /^\$\d{1,3}$/.test(t));
    expect(dollarCounts).toEqual([]);
    // Plain round counts from fixture (Florida=2, Central=1, Texas=1) should appear
    expect(texts.some((t) => t === "1" || t === "2")).toBe(true);
  });
});

describe("planner chart kinds", () => {
  it("region scorecard includes combo and waterfall for exec layout", () => {
    const plan = planDashboardFromPrompt("Build a region scorecard");
    const kinds = new Set(plan.widgets.map((w) => w.kind));
    expect(kinds.has("kpi")).toBe(true);
    expect(kinds.has("horizontal_bar") || kinds.has("bar")).toBe(true);
    expect(kinds.has("combo")).toBe(true);
    expect(kinds.has("waterfall")).toBe(true);
  });

  it("pipeline mix intent produces composition + waterfall", () => {
    const plan = planDashboardFromPrompt("pipeline mix by status");
    const kinds = plan.widgets.map((w) => w.kind);
    expect(kinds.some((k) => k === "pie" || k === "donut")).toBe(true);
    expect(kinds).toContain("waterfall");
  });

  it("resolveWidgets paints combo and waterfall without empty crash", () => {
    const plan = planDashboardFromPrompt("executive scorecard");
    const resolved = resolveWidgets(plan.widgets, fixtureRounds());
    const combo = resolved.find((w) => w.config.kind === "combo");
    const waterfall = resolved.find((w) => w.config.kind === "waterfall");
    expect(combo?.combo?.rows.length).toBeGreaterThan(0);
    expect(waterfall?.waterfall?.points.length).toBe(4);
    expect(waterfall?.empty).toBe(false);
  });
});
