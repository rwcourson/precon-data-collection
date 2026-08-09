import { describe, expect, it } from "vitest";
import { planDashboardFromPrompt } from "./dashboard-copilot";

describe("planDashboardFromPrompt", () => {
  it("builds a Florida win-rate canvas with region filter", () => {
    const plan = planDashboardFromPrompt("What's our win rate in Florida?");
    expect(plan.widgets.length).toBeGreaterThanOrEqual(4);
    expect(plan.widgets.some((w) => w.metricKey === "winRate")).toBe(true);
    const filtered = plan.widgets.filter((w) =>
      w.filters?.some((f) => f.field === "region" && f.value === "Florida"),
    );
    expect(filtered.length).toBeGreaterThan(0);
    expect(plan.name.toLowerCase()).toMatch(/florida|win rate/);
  });

  it("builds an executive scorecard for short dashboard asks", () => {
    const plan = planDashboardFromPrompt("Build a region scorecard");
    expect(plan.widgets.length).toBeGreaterThanOrEqual(6);
    expect(plan.widgets.some((w) => w.kind === "kpi")).toBe(true);
  });
});
