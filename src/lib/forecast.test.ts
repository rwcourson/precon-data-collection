import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORECAST_ASSUMPTIONS,
  buildForecastSeries,
  resolveForecastTimingDate,
  type ForecastRoundInput,
} from "./forecast";

const base = (over: Partial<ForecastRoundInput> & Pick<ForecastRoundInput, "id">): ForecastRoundInput => ({
  jobId: 1,
  jobNumber: "TBD-1",
  jobName: "Test",
  estimateValue: 10_000_000,
  timingDate: "2026-06-15",
  outcome: "pending",
  region: "Central",
  ...over,
});

describe("resolveForecastTimingDate", () => {
  it("prefers project start over bid due", () => {
    expect(
      resolveForecastTimingDate({
        projectStartDate: "2027-01-01",
        bidDueDate: "2026-06-01",
      }),
    ).toBe("2027-01-01");
  });

  it("falls back to bid due and never invents a date", () => {
    expect(
      resolveForecastTimingDate({ projectStartDate: null, bidDueDate: "2026-06-01" }),
    ).toBe("2026-06-01");
    expect(
      resolveForecastTimingDate({ projectStartDate: null, bidDueDate: null }),
    ).toBeNull();
  });
});

describe("buildForecastSeries", () => {
  it("places objective volume in the source month at 100%", () => {
    const series = buildForecastSeries([base({ id: 1 })], {
      pendingWinProbability: 0.5,
      scheduleSlipMonths: 2,
    });
    expect(series.months.find((m) => m.month === "2026-06")?.objective).toBe(10_000_000);
    expect(series.totals.objective).toBe(10_000_000);
  });

  it("applies pending win probability and schedule slip only on the adjusted curve", () => {
    const series = buildForecastSeries([base({ id: 1 })], {
      pendingWinProbability: 0.5,
      scheduleSlipMonths: 2,
    });
    expect(series.months.find((m) => m.month === "2026-06")?.adjusted).toBe(0);
    expect(series.months.find((m) => m.month === "2026-08")?.adjusted).toBe(5_000_000);
    expect(series.totals.adjusted).toBe(5_000_000);
  });

  it("treats successful as 1.0 and unsuccessful as 0.0 without slip", () => {
    const series = buildForecastSeries(
      [
        base({ id: 1, outcome: "successful", estimateValue: 8_000_000 }),
        base({ id: 2, outcome: "unsuccessful", estimateValue: 4_000_000 }),
      ],
      DEFAULT_FORECAST_ASSUMPTIONS,
    );
    expect(series.totals.objective).toBe(12_000_000);
    expect(series.totals.adjusted).toBe(8_000_000);
    expect(series.months.every((m) => m.month === "2026-06")).toBe(true);
  });

  it("excludes missing value/date instead of zeroing", () => {
    const series = buildForecastSeries([
      base({ id: 1, estimateValue: null }),
      base({ id: 2, timingDate: null, estimateValue: 1 }),
      base({ id: 3, timingDate: "not-a-date", estimateValue: 1 }),
      base({ id: 4, estimateValue: 2_000_000 }),
    ]);
    expect(series.excluded.map((e) => e.roundId).sort()).toEqual([1, 2, 3]);
    expect(series.totals.objective).toBe(2_000_000);
  });

  it("lists contributing round ids for a month", () => {
    const series = buildForecastSeries([
      base({ id: 10, estimateValue: 1_000_000 }),
      base({ id: 11, estimateValue: 2_000_000, timingDate: "2026-06-01" }),
    ]);
    expect(series.months.find((m) => m.month === "2026-06")?.contributingRoundIds).toEqual([
      10, 11,
    ]);
  });
});
