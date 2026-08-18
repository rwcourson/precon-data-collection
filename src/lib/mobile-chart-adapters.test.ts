import { describe, expect, it } from "vitest";
import {
  BG_SERIES_LIGHT,
  chartMaxValue,
  formatAxisTick,
  isEmptySeries,
  normalizeByStatusMap,
  normalizeForecastMonths,
  normalizeStatusSeries,
  seriesColorAt,
  shortLabel,
  toPlotValue,
} from "@/lib/mobile-chart-adapters";

describe("mobile-chart-adapters (shipped)", () => {
  it("seriesColorAt wraps B&G Time palette", () => {
    expect(seriesColorAt(0)).toBe(BG_SERIES_LIGHT[0]);
    expect(seriesColorAt(BG_SERIES_LIGHT.length)).toBe(BG_SERIES_LIGHT[0]);
    expect(seriesColorAt(1, true)).toMatch(/^#/);
  });

  it("normalizeStatusSeries maps dashboard statusSeries shape with multi colors", () => {
    const points = normalizeStatusSeries([
      { label: "locked", value: 227 },
      { label: "submitted", value: 73 },
      { label: "outstanding", value: 69 },
      { label: "upcoming", value: 0 },
    ]);
    expect(points).toHaveLength(3);
    expect(points[0].value).toBe(227);
    expect(points[0].color).toBe(BG_SERIES_LIGHT[0]);
    expect(points[1].color).toBe(BG_SERIES_LIGHT[1]);
    expect(isEmptySeries(points)).toBe(false);
  });

  it("normalizeForecastMonths dual-series from live forecast shape", () => {
    const points = normalizeForecastMonths([
      { month: "2025-06", objective: 175_000_000, adjusted: 0 },
      { month: "2025-08", objective: 30_000_000, adjusted: 96_250_000 },
    ]);
    expect(points).toHaveLength(2);
    expect(points[0].label).toBe("06");
    expect(points[0].value).toBe(175_000_000);
    expect(points[1].value2).toBe(96_250_000);
    expect(chartMaxValue(points, true)).toBeGreaterThan(175_000_000);
  });

  it("normalizeByStatusMap reads overview byStatus", () => {
    const pts = normalizeByStatusMap({
      active: 21,
      locked: 227,
      post_bid: 14,
    });
    expect(pts.some((p) => p.label.includes("locked") || p.value === 227)).toBe(
      true
    );
    expect(pts.every((p) => p.value > 0)).toBe(true);
  });

  it("empty detection and sanitizers", () => {
    expect(isEmptySeries([])).toBe(true);
    expect(isEmptySeries([{ label: "a", value: 0 }])).toBe(true);
    expect(toPlotValue(null)).toBe(0);
    expect(toPlotValue(NaN)).toBe(0);
    expect(shortLabel("precon_department", 8)).toMatch(/…$/);
  });

  it("formatAxisTick compact dollars for large magnitudes", () => {
    expect(formatAxisTick("31000000000", "dollars")).toBe("$31.0B");
    expect(formatAxisTick("45000000", "auto")).toBe("$45.0M");
    expect(formatAxisTick("227", "number")).toBe("227");
    expect(formatAxisTick("12", "auto")).toBe("12");
  });
});
