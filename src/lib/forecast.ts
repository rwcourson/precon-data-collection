/**
 * Precon volume projection curves.
 *
 * Objective ("blue") curve: 100% of priced volume at stated timing — the top end.
 * Risk-adjusted ("green") curve: applies explicit win probability and schedule slip
 * assumptions. Raw round inputs are never mutated.
 */

export type ForecastRoundInput = {
  id: number;
  jobId: number;
  jobNumber: string;
  jobName: string;
  estimateValue: number | null;
  /** Preferred timing: project start, else bid due date (YYYY-MM-DD). */
  timingDate: string | null;
  outcome: "pending" | "successful" | "unsuccessful";
  region: string;
};

export type ForecastAssumptions = {
  /** Applied to pending outcomes only. Won = 1, lost = 0. */
  pendingWinProbability: number;
  /** Months to push pending timing for the adjusted curve. */
  scheduleSlipMonths: number;
};

export const DEFAULT_FORECAST_ASSUMPTIONS: ForecastAssumptions = {
  pendingWinProbability: 0.55,
  scheduleSlipMonths: 2,
};

/** YYYY-MM */
type MonthKey = string;

export type ForecastMonthPoint = {
  month: MonthKey;
  objective: number;
  adjusted: number;
  contributingRoundIds: number[];
};

export type ForecastSeries = {
  assumptions: ForecastAssumptions;
  months: ForecastMonthPoint[];
  totals: { objective: number; adjusted: number };
  excluded: { roundId: number; reason: string }[];
};

function parseMonth(date: string): MonthKey | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function winFactor(
  outcome: ForecastRoundInput["outcome"],
  pendingWinProbability: number
): number {
  if (outcome === "successful") return 1;
  if (outcome === "unsuccessful") return 0;
  return pendingWinProbability;
}

/**
 * Build monthly objective and risk-adjusted series from raw round inputs.
 * Excludes rounds missing value or a parseable timing date (reported, not zeroed).
 */
export function buildForecastSeries(
  rounds: ForecastRoundInput[],
  assumptions: ForecastAssumptions = DEFAULT_FORECAST_ASSUMPTIONS
): ForecastSeries {
  const excluded: ForecastSeries["excluded"] = [];
  const byMonth = new Map<
    MonthKey,
    { objective: number; adjusted: number; ids: Set<number> }
  >();

  for (const r of rounds) {
    if (r.estimateValue == null || !Number.isFinite(r.estimateValue)) {
      excluded.push({ roundId: r.id, reason: "missing_estimate_value" });
      continue;
    }
    if (!r.timingDate) {
      excluded.push({ roundId: r.id, reason: "missing_timing_date" });
      continue;
    }
    const baseMonth = parseMonth(r.timingDate);
    if (!baseMonth) {
      excluded.push({ roundId: r.id, reason: "invalid_timing_date" });
      continue;
    }

    const value = r.estimateValue;
    const factor = winFactor(r.outcome, assumptions.pendingWinProbability);
    const adjustedMonth =
      r.outcome === "pending"
        ? addMonths(baseMonth, assumptions.scheduleSlipMonths)
        : baseMonth;

    const obj = byMonth.get(baseMonth) ?? {
      objective: 0,
      adjusted: 0,
      ids: new Set<number>(),
    };
    obj.objective += value;
    obj.ids.add(r.id);
    byMonth.set(baseMonth, obj);

    const adj = byMonth.get(adjustedMonth) ?? {
      objective: 0,
      adjusted: 0,
      ids: new Set<number>(),
    };
    adj.adjusted += value * factor;
    adj.ids.add(r.id);
    byMonth.set(adjustedMonth, adj);
  }

  const months = [...byMonth.keys()].sort().map((month) => {
    const row = byMonth.get(month)!;
    return {
      month,
      objective: row.objective,
      adjusted: row.adjusted,
      contributingRoundIds: [...row.ids].sort((a, b) => a - b),
    };
  });

  return {
    assumptions,
    months,
    totals: {
      objective: months.reduce((s, m) => s + m.objective, 0),
      adjusted: months.reduce((s, m) => s + m.adjusted, 0),
    },
    excluded,
  };
}

/** Prefer project start, fall back to bid due — never invent a date. */
export function resolveForecastTimingDate(input: {
  projectStartDate: string | null;
  bidDueDate: string | null;
}): string | null {
  return input.projectStartDate ?? input.bidDueDate ?? null;
}
