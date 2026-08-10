import type { DashboardWidgetConfig, EstimateRound } from "@/db/schema";
import { fmtDollars, fmtNumber, fmtPercent } from "@/lib/format";
import { computeStats, rollup } from "@/lib/rollup";

export type WidgetSeriesPoint = { name: string; value: number; secondary?: number };
export type WidgetTrendPoint = Record<string, string | number | null>;
export type WidgetTableRow = Record<string, string | number | null>;

export type WidgetResolved = {
  config: DashboardWidgetConfig;
  empty: boolean;
  kpi?: { value: string; sub?: string; raw: number | null };
  series?: WidgetSeriesPoint[];
  trend?: WidgetTrendPoint[];
  trendKeys?: { key: string; label: string }[];
  stacked?: { rows: Record<string, string | number>[]; series: string[] };
  table?: { columns: string[]; rows: WidgetTableRow[] };
  /** ComboChart: category + bar metric + line metric. */
  combo?: {
    rows: Record<string, string | number>[];
    categoryKey: string;
    barKeys: string[];
    lineKeys: string[];
  };
  /** WaterfallChart points (increase / decrease / total). */
  waterfall?: {
    points: { name: string; value: number; type: "increase" | "decrease" | "total" }[];
  };
};

type MetricKey =
  | "estimateValue"
  | "feeExpected"
  | "feeExpectedPct"
  | "contingencyTotal"
  | "roundCount"
  | "winRate";

const METRIC_LABELS: Record<MetricKey, string> = {
  estimateValue: "Pursuit volume",
  feeExpected: "Fee expected",
  feeExpectedPct: "Fee %",
  contingencyTotal: "Contingency",
  roundCount: "Estimate rounds",
  winRate: "Win rate",
};

function sizeBucketLabel(value: number | null | undefined): string {
  const v = value ?? 0;
  if (v < 10_000_000) return "<$10M";
  if (v < 50_000_000) return "$10–50M";
  if (v < 100_000_000) return "$50–100M";
  if (v < 250_000_000) return "$100–250M";
  return "$250M+";
}

const SIZE_BUCKET_ORDER = ["<$10M", "$10–50M", "$50–100M", "$100–250M", "$250M+"];

function groupValue(r: EstimateRound, groupBy: string): string {
  switch (groupBy) {
    case "region":
      return r.region || "Unclassified";
    case "preconDepartment":
      return r.preconDepartment || "Unclassified";
    case "marketSector":
      return r.marketSector || "Unclassified";
    case "estimatePhase":
      return r.estimatePhase || "Unclassified";
    case "bidYear":
      return String(r.bidYear ?? "—");
    case "status":
      return r.status || "—";
    case "outcome":
      return r.outcome === "successful"
        ? "Won"
        : r.outcome === "unsuccessful"
          ? "Lost"
          : "Pending";
    case "sizeBucket":
      return sizeBucketLabel(r.estimateValue);
    default:
      return "All";
  }
}

function applyFilters(rounds: EstimateRound[], filters?: DashboardWidgetConfig["filters"]) {
  if (!filters?.length) return rounds;
  return rounds.filter((r) => {
    for (const f of filters) {
      const raw = (r as Record<string, unknown>)[f.field];
      const left = raw == null ? "" : String(raw);
      const right = f.value;
      const ln = Number(left);
      const rn = Number(right);
      switch (f.op) {
        case "eq":
          if (left.toLowerCase() !== right.toLowerCase()) return false;
          break;
        case "contains":
          if (!left.toLowerCase().includes(right.toLowerCase())) return false;
          break;
        case "gt":
          if (!(Number.isFinite(ln) && Number.isFinite(rn) && ln > rn)) return false;
          break;
        case "lt":
          if (!(Number.isFinite(ln) && Number.isFinite(rn) && ln < rn)) return false;
          break;
        case "gte":
          if (!(Number.isFinite(ln) && Number.isFinite(rn) && ln >= rn)) return false;
          break;
        case "lte":
          if (!(Number.isFinite(ln) && Number.isFinite(rn) && ln <= rn)) return false;
          break;
        default:
          return false;
      }
    }
    return true;
  });
}

/** If filters wipe the set, drop them so the canvas never shows empty-by-mistake. */
function roundsForWidget(rounds: EstimateRound[], filters?: DashboardWidgetConfig["filters"]) {
  const filtered = applyFilters(rounds, filters);
  if (filtered.length === 0 && filters?.length) return { rounds: rounds, filtersDropped: true };
  return { rounds: filtered, filtersDropped: false };
}

function metricFromStats(stats: ReturnType<typeof computeStats>, metric: MetricKey): number | null {
  switch (metric) {
    case "estimateValue":
      return stats.volume;
    case "feeExpected":
      return stats.totalFee;
    case "feeExpectedPct":
      return stats.weightedFeePct;
    case "contingencyTotal":
      return stats.weightedContingencyPct != null
        ? stats.volume * stats.weightedContingencyPct
        : null;
    case "roundCount":
      return stats.rounds;
    case "winRate":
      return stats.winRate;
    default:
      return null;
  }
}

function formatMetric(metric: MetricKey, value: number | null, format?: string | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (format === "percent" || metric === "winRate" || metric === "feeExpectedPct") {
    return fmtPercent(value);
  }
  if (format === "number" || metric === "roundCount") return fmtNumber(value);
  return fmtDollars(value, true);
}

function resolveMetric(config: DashboardWidgetConfig): MetricKey {
  const key = config.metricKey as MetricKey | null | undefined;
  if (
    key === "estimateValue" ||
    key === "feeExpected" ||
    key === "feeExpectedPct" ||
    key === "contingencyTotal" ||
    key === "roundCount" ||
    key === "winRate"
  ) {
    return key;
  }
  return "estimateValue";
}

/** Execute one widget config against estimate rounds (read-only). */
export function resolveWidget(
  config: DashboardWidgetConfig,
  allRounds: EstimateRound[],
): WidgetResolved {
  const { rounds, filtersDropped } = roundsForWidget(allRounds, config.filters);
  const metric = resolveMetric(config);
  const groupBy = config.groupBy ?? "region";
  const subNote = filtersDropped ? " · filters relaxed (no matches)" : "";

  if (config.kind === "kpi") {
    const stats = computeStats("all", rounds);
    const raw = metricFromStats(stats, metric);
    return {
      config,
      empty: rounds.length === 0,
      kpi: {
        value: formatMetric(metric, raw, config.format),
        sub: `${stats.rounds.toLocaleString()} rounds · ${METRIC_LABELS[metric]}${subNote}`,
        raw,
      },
    };
  }

  if (config.kind === "line" || config.kind === "area" || config.kind === "projection") {
    const years = [...new Set(rounds.map((r) => r.bidYear))].sort();
    const trend = years.map((y) => {
      const stats = computeStats(String(y), rounds.filter((r) => r.bidYear === y));
      return {
        year: y,
        value: metricFromStats(stats, metric) ?? 0,
        volume: stats.volume,
        winRate: stats.winRate,
        feePct: stats.weightedFeePct,
        rounds: stats.rounds,
      };
    });
    return {
      config,
      empty: trend.length === 0,
      trend,
      trendKeys: [
        { key: "value", label: METRIC_LABELS[metric] },
        ...(config.kind === "projection"
          ? [
              { key: "volume", label: "Volume" },
              { key: "winRate", label: "Win rate" },
            ]
          : []),
      ],
    };
  }

  if (config.kind === "stacked_bar") {
    const years = [...new Set(rounds.map((r) => r.bidYear))].sort();
    let groups = [...new Set(rounds.map((r) => groupValue(r, groupBy)))];
    if (groupBy === "sizeBucket") {
      groups = SIZE_BUCKET_ORDER.filter((b) => groups.includes(b));
    } else {
      groups = groups.slice(0, 8);
    }
    const rows = years.map((y) => {
      const row: Record<string, string | number> = { year: y };
      for (const g of groups) {
        const subset = rounds.filter(
          (r) => r.bidYear === y && groupValue(r, groupBy) === g,
        );
        row[g] = metricFromStats(computeStats(g, subset), metric) ?? 0;
      }
      return row;
    });
    return {
      config,
      empty: rows.length === 0 || rounds.length === 0,
      stacked: { rows, series: groups },
    };
  }

  if (config.kind === "combo") {
    // Dual-axis story: volume (bars) + win rate (line) by bid year.
    const years = [...new Set(rounds.map((r) => r.bidYear))].sort();
    const rows = years.map((y) => {
      const stats = computeStats(String(y), rounds.filter((r) => r.bidYear === y));
      return {
        year: String(y),
        volume: stats.volume,
        winRate: (stats.winRate ?? 0) * 100,
      };
    });
    return {
      config,
      empty: rows.length === 0 || rounds.length === 0,
      combo: {
        rows,
        categoryKey: "year",
        barKeys: ["volume"],
        lineKeys: ["winRate"],
      },
    };
  }

  if (config.kind === "waterfall") {
    // Portfolio bridge by outcome — increase/decrease then total.
    const won = computeStats("won", rounds.filter((r) => r.outcome === "successful"));
    const lost = computeStats("lost", rounds.filter((r) => r.outcome === "unsuccessful"));
    const pending = computeStats("pending", rounds.filter((r) => r.outcome === "pending"));
    const total = computeStats("all", rounds);
    const points: NonNullable<WidgetResolved["waterfall"]>["points"] = [
      { name: "Won", value: won.volume, type: "increase" },
      { name: "Pending", value: pending.volume, type: "increase" },
      { name: "Lost", value: lost.volume, type: "decrease" },
      { name: "Total pipeline", value: total.volume, type: "total" },
    ];
    return {
      config,
      empty: rounds.length === 0 || points.every((p) => p.value === 0),
      waterfall: { points },
    };
  }

  // bar | horizontal_bar | pie | donut | table | reconciliation
  let groups = rollup(rounds, (r) => groupValue(r, groupBy));
  if (groupBy === "sizeBucket") {
    groups = [...groups].sort(
      (a, b) => SIZE_BUCKET_ORDER.indexOf(a.key) - SIZE_BUCKET_ORDER.indexOf(b.key),
    );
  } else {
    groups = groups.slice(0, 12);
  }
  const series = groups.map((g) => ({
    name: g.key,
    value: metricFromStats(g, metric) ?? 0,
    secondary: g.rounds,
  }));

  if (config.kind === "table" || config.kind === "reconciliation") {
    const groupLabel =
      config.groupBy === "preconDepartment"
        ? "Department"
        : config.groupBy === "marketSector"
          ? "Market sector"
          : config.groupBy === "estimatePhase"
            ? "Phase"
            : config.groupBy === "bidYear"
              ? "Bid year"
              : config.groupBy === "status"
                ? "Status"
                : config.groupBy === "outcome"
                  ? "Outcome"
                  : config.groupBy === "sizeBucket"
                    ? "Size bucket"
                    : "Region";
    const rows: WidgetTableRow[] = groups.map((g) => ({
      [groupLabel]: g.key,
      "Pursuit volume": g.volume,
      "Estimate rounds": g.rounds,
      "Win rate": g.winRate,
      "Expected fee": g.totalFee,
      "Fee %": g.weightedFeePct,
    }));
    return {
      config,
      empty: rows.length === 0,
      table: {
        columns: [
          groupLabel,
          "Pursuit volume",
          "Estimate rounds",
          "Win rate",
          "Expected fee",
          "Fee %",
        ],
        rows,
      },
      series,
    };
  }

  return {
    config,
    empty: series.length === 0,
    series,
  };
}

export function resolveWidgets(
  configs: DashboardWidgetConfig[],
  allRounds: EstimateRound[],
): WidgetResolved[] {
  return configs.map((c) => resolveWidget(c, allRounds));
}

export { METRIC_LABELS };
