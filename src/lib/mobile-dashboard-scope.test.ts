import { describe, expect, it } from "vitest";
import {
  groupVolumeChartTitle,
  groupVolumeForLevel,
  parseDashboardLevel,
  scopeRoundsForLevel,
  statusSeriesFromRounds,
  type ScopeableRound,
} from "@/lib/mobile-dashboard-scope";

function r(partial: Partial<ScopeableRound> & { region: string }): ScopeableRound {
  return {
    status: "active",
    preconDepartment: "Central Building Group",
    marketSector: "Healthcare",
    estimateValue: 1_000_000,
    ...partial,
  };
}

describe("mobile-dashboard-scope (shipped, web-aligned)", () => {
  const rows: ScopeableRound[] = [
    r({ region: "Central", preconDepartment: "CBG", marketSector: "Health", estimateValue: 10 }),
    r({ region: "Central", preconDepartment: "Heavy", marketSector: "Industrial", estimateValue: 20 }),
    r({ region: "Florida", preconDepartment: "FL Precon", marketSector: "Health", estimateValue: 30 }),
    r({ region: "Florida", preconDepartment: "FL Precon", marketSector: "Office", estimateValue: 5, status: "locked" }),
  ];

  it("parseDashboardLevel defaults safely", () => {
    expect(parseDashboardLevel("region")).toBe("region");
    expect(parseDashboardLevel("nope")).toBe("corporate");
  });

  it("corporate keeps all rows; region/division filter to focus region", () => {
    expect(scopeRoundsForLevel(rows, "corporate", "Central")).toHaveLength(4);
    const central = scopeRoundsForLevel(rows, "region", "Central");
    expect(central).toHaveLength(2);
    expect(central.every((x) => x.region === "Central")).toBe(true);
    expect(scopeRoundsForLevel(rows, "division", "Florida")).toHaveLength(2);
  });

  it("group dimension changes by level like web dashboards", () => {
    const corp = groupVolumeForLevel(rows, "corporate");
    expect(corp.map((g) => g.label).sort()).toEqual(["Central", "Florida"]);
    expect(corp.find((g) => g.label === "Florida")?.value).toBe(35);

    const reg = groupVolumeForLevel(
      scopeRoundsForLevel(rows, "region", "Central"),
      "region",
    );
    expect(reg.map((g) => g.label).sort()).toEqual(["CBG", "Heavy"]);

    const div = groupVolumeForLevel(
      scopeRoundsForLevel(rows, "division", "Florida"),
      "division",
    );
    expect(div.some((g) => g.label === "Health")).toBe(true);
    expect(div.some((g) => g.label === "Office")).toBe(true);
  });

  it("status series uses scoped rows only", () => {
    const scoped = scopeRoundsForLevel(rows, "region", "Florida");
    const series = statusSeriesFromRounds(scoped);
    expect(series.reduce((s, x) => s + x.value, 0)).toBe(2);
  });

  it("chart titles reflect group dimension", () => {
    expect(groupVolumeChartTitle("corporate")).toMatch(/region/i);
    expect(groupVolumeChartTitle("region")).toMatch(/division/i);
    expect(groupVolumeChartTitle("division")).toMatch(/market/i);
  });
});
