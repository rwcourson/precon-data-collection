/**
 * Maps shipped RollupStats (rounds + volume) into Annual Report UI labels.
 * Must stay aligned with `src/lib/rollup.ts` RollupStats — not invented fields.
 */

export type RollupStatsLike = {
  rounds?: number;
  volume?: number;
  winRate?: number | null;
  /** Wrong legacy field names — ignored when rounds/volume present */
  count?: number;
  totalValue?: number;
};

export function roundsFromStats(stats: RollupStatsLike | null | undefined): number {
  if (!stats) return 0;
  if (typeof stats.rounds === "number") return stats.rounds;
  if (typeof stats.count === "number") return stats.count;
  return 0;
}

export function volumeFromStats(stats: RollupStatsLike | null | undefined): number | null {
  if (!stats) return null;
  if (typeof stats.volume === "number") return stats.volume;
  if (typeof stats.totalValue === "number") return stats.totalValue;
  return null;
}

export function formatDollars(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function formatRoundsVolumeLine(stats: RollupStatsLike | null | undefined): string {
  const rounds = roundsFromStats(stats);
  return `${rounds} rounds · ${formatDollars(volumeFromStats(stats))}`;
}

export function formatRoundsBadge(stats: RollupStatsLike | null | undefined): string {
  return `${roundsFromStats(stats)} rounds`;
}
