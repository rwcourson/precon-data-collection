import type { EstimateRound } from "@/db/schema";

/**
 * Rollup aggregation for dashboards (BRD Section 13). Each Estimate Round
 * counts as its own record in volume metrics at every level.
 *
 * Portfolio ratios are dollar-weighted (sum of numerators / sum of
 * denominators) rather than an average of per-round percentages, so a $200M
 * pursuit does not carry the same weight as a $2M one. Where leadership also
 * tracks the simple mean, both are exposed (`avgFeePct` vs `weightedFeePct`).
 */

export type RollupStats = {
  key: string;
  rounds: number;
  volume: number;
  submittedVolume: number;
  avgEstimateValue: number | null;
  wins: number;
  decided: number;
  winRate: number | null;
  wonVolume: number;
  decidedVolume: number;
  winRateByValue: number | null;
  totalFee: number;
  avgFeePct: number | null;
  weightedFeePct: number | null;
  avgContingencyPct: number | null;
  weightedContingencyPct: number | null;
  weightedGcGrPct: number | null;
  feePerPmMonth: number | null;
  revenuePerPmYear: number | null;
  totalPmMonths: number;
  totalSelfPerform: number;
  selfPerformCaptureRate: number | null;
  totalManHours: number;
  laborCostPerManHour: number | null;
  costPerGsf: number | null;
  totalGsf: number;
};

export function rollup(rounds: EstimateRound[], keyFn: (r: EstimateRound) => string): RollupStats[] {
  const groups = new Map<string, EstimateRound[]>();
  for (const r of rounds) {
    const k = keyFn(r);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  return [...groups.entries()]
    .map(([key, rs]) => computeStats(key, rs))
    .sort((a, b) => b.volume - a.volume);
}

export function computeStats(key: string, rs: EstimateRound[]): RollupStats {
  const volume = sum(rs.map((r) => r.estimateValue));
  const submitted = rs.filter((r) => ["submitted", "post_bid", "locked"].includes(r.status));
  const decidedRounds = rs.filter((r) => r.outcome !== "pending");
  const wonRounds = rs.filter((r) => r.outcome === "successful");

  const feePcts = rs
    .filter((r) => r.feeExpected != null && r.estimateValue)
    .map((r) => r.feeExpected! / r.estimateValue!);
  const contPcts = rs
    .filter((r) => r.contingencyTotal != null && r.estimateValue)
    .map((r) => r.contingencyTotal! / r.estimateValue!);

  const totalFee = sum(rs.map((r) => r.feeExpected));
  const totalPmMonths = sum(rs.map((r) => r.pmMonths));
  const totalContingency = sum(rs.map((r) => r.contingencyTotal));
  const totalGcGr = sum(rs.map((r) => r.gcBgSort)) + sum(rs.map((r) => r.grBgSort));
  const totalSelfPerformPriced = sum(rs.map((r) => r.selfPerformPriced));
  const totalSelfPerformProposed = sum(rs.map((r) => r.selfPerformProposed));
  const totalManHours = sum(rs.map((r) => r.craftLaborManHours));
  const totalLaborCost = sum(rs.map((r) => r.craftLaborBase)) + sum(rs.map((r) => r.craftLaborBurden));

  // $/GSF only reconciles across rounds that actually report GSF.
  const gsfRounds = rs.filter((r) => r.gsf != null && r.gsf > 0);
  const totalGsf = sum(gsfRounds.map((r) => r.gsf));
  const gsfRoundsVolume = sum(gsfRounds.map((r) => r.estimateValue));

  const decidedVolume = sum(decidedRounds.map((r) => r.estimateValue));
  const wonVolume = sum(wonRounds.map((r) => r.estimateValue));

  return {
    key,
    rounds: rs.length,
    volume,
    submittedVolume: sum(submitted.map((r) => r.estimateValue)),
    avgEstimateValue: rs.length > 0 ? volume / rs.length : null,
    wins: wonRounds.length,
    decided: decidedRounds.length,
    winRate: decidedRounds.length > 0 ? wonRounds.length / decidedRounds.length : null,
    wonVolume,
    decidedVolume,
    winRateByValue: decidedVolume > 0 ? wonVolume / decidedVolume : null,
    totalFee,
    avgFeePct: avg(feePcts),
    weightedFeePct: ratio(totalFee, volume),
    avgContingencyPct: avg(contPcts),
    weightedContingencyPct: ratio(totalContingency, volume),
    weightedGcGrPct: ratio(totalGcGr, volume),
    feePerPmMonth: ratio(totalFee, totalPmMonths),
    revenuePerPmYear: ratio(volume, totalPmMonths / 12),
    totalPmMonths,
    totalSelfPerform: totalSelfPerformProposed,
    selfPerformCaptureRate: ratio(totalSelfPerformProposed, totalSelfPerformPriced),
    totalManHours,
    laborCostPerManHour: ratio(totalLaborCost, totalManHours),
    costPerGsf: ratio(gsfRoundsVolume, totalGsf),
    totalGsf,
  };
}

const sum = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
const avg = (xs: number[]) => (xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
