import { describe, expect, it } from "vitest";
import type { EstimateRound } from "@/db/schema";
import {
  applyNotApplicableByRound,
  calcMetric,
  METRIC_MAP,
  roundForMetrics,
} from "./metrics";
import { computeStats } from "./rollup";

const laborRound = {
  id: 7,
  estimateValue: 12_000_000,
  craftLaborManHours: 1200,
  craftLaborBase: 24_000,
  craftLaborBurden: 12_000,
  feeExpected: null,
  contingencyTotal: null,
  pmMonths: null,
  gcBgSort: null,
  grBgSort: null,
  selfPerformPriced: null,
  selfPerformProposed: null,
  gsf: null,
  status: "locked",
  outcome: "pending",
} as EstimateRound;

describe("N/A metric masking", () => {
  it("nulls N/A hours before a formula can use them", () => {
    const masked = roundForMetrics(laborRound, new Set(["craftLaborManHours"]));
    expect(masked.craftLaborManHours).toBeNull();
    expect(masked.estimateValue).toBe(12_000_000);
    expect(calcMetric(METRIC_MAP.manHoursPerMillion!, laborRound)).toBe(100);
    expect(
      calcMetric(
        METRIC_MAP.manHoursPerMillion!,
        laborRound,
        new Set(["craftLaborManHours"])
      )
    ).toBeNull();
  });

  it("drops N/A hours from leadership rollup denominators", () => {
    expect(computeStats("all", [laborRound]).totalManHours).toBe(1200);
    const masked = applyNotApplicableByRound(
      [laborRound],
      new Map([[7, new Set(["craftLaborManHours"])]])
    );
    expect(computeStats("all", masked).totalManHours).toBe(0);
    expect(computeStats("all", masked).laborCostPerManHour).toBeNull();
  });
});
