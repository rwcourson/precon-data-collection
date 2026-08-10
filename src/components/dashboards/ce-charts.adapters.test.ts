import { describe, expect, it } from "vitest";
import { createElement, isValidElement } from "react";
import {
  ChartEmptyState,
  ComboMetricChart,
  HorizontalBarChart,
  PieDonutMetricChart,
  VerticalBarChart,
  WaterfallMetricChart,
} from "@/components/dashboards/ce-charts";
import {
  formatTableCell,
  humanizeCategory,
  scaleForMetric,
} from "@/components/dashboards/chart-format";

describe("chart adapters smoke", () => {
  it("formatters still produce BI-readable labels", () => {
    const currency = scaleForMetric([31_000_000_000], "currency");
    expect(currency.format(31)).toMatch(/\$31/);
    expect(scaleForMetric([0.7], "percent").format(70)).toBe("70.0%");
    expect(humanizeCategory("post_bid")).toBe("Post-bid");
    expect(formatTableCell("Win rate", 0.55)).toBe("55%");
  });

  it("renders empty-state without throw", () => {
    const el = createElement(ChartEmptyState, { label: "No data" });
    expect(isValidElement(el)).toBe(true);
  });

  it("horizontal/vertical bars accept series and empty", () => {
    const empty = createElement(HorizontalBarChart, { data: [] });
    expect(isValidElement(empty)).toBe(true);
    const filled = createElement(HorizontalBarChart, {
      data: [
        { name: "Central", value: 1e9 },
        { name: "Florida", value: 5e8 },
      ],
    });
    expect(isValidElement(filled)).toBe(true);
    expect(
      isValidElement(
        createElement(VerticalBarChart, {
          data: [{ name: "2025", value: 2e8 }],
        }),
      ),
    ).toBe(true);
  });

  it("pie/combo/waterfall adapters do not throw on short series", () => {
    expect(
      isValidElement(
        createElement(PieDonutMetricChart, {
          data: [
            { name: "active", value: 10 },
            { name: "locked", value: 5 },
          ],
          donut: true,
        }),
      ),
    ).toBe(true);
    expect(
      isValidElement(
        createElement(ComboMetricChart, {
          rows: [
            { year: "2025", volume: 1e9, winRate: 55 },
            { year: "2026", volume: 1.2e9, winRate: 48 },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isValidElement(
        createElement(WaterfallMetricChart, {
          points: [
            { name: "Won", value: 100, type: "increase" },
            { name: "Lost", value: 40, type: "decrease" },
            { name: "Total", value: 60, type: "total" },
          ],
        }),
      ),
    ).toBe(true);
    expect(isValidElement(createElement(WaterfallMetricChart, { points: [] }))).toBe(
      true,
    );
  });
});
