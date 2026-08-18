/**
 * Display-scale helpers for chart-elements adapters.
 * CE only applies valueFormatter to tooltips — not axis ticks — so we
 * pre-scale series values so axes stay readable (Power BI style).
 */

export type ScaleKind = "currency" | "percent" | "count" | "raw";

export type ScaledSeries = {
  /** Values ready for charting (already scaled for axes). */
  values: number[];
  /** Format a chart-space value for tooltips / labels. */
  format: (v: number) => string;
  /** Short unit for axis context, e.g. "$B", "%". */
  unitLabel: string;
  scale: number;
};

export function dollarsCompact(v: number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function percentLabel(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function countLabel(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
}

/** Humanize status / enum labels for legends and categories. */
export function humanizeCategory(name: string): string {
  const key = name.trim().toLowerCase();
  const map: Record<string, string> = {
    post_bid: "Post-bid",
    "post-bid": "Post-bid",
    active: "Active",
    upcoming: "Upcoming",
    outstanding: "Outstanding",
    submitted: "Submitted",
    locked: "Locked",
    pending: "Pending",
    successful: "Won",
    unsuccessful: "Lost",
  };
  if (map[key]) return map[key];
  if (name.includes("_")) {
    return name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return name;
}

/**
 * Choose a display scale so axis ticks stay short.
 * Currency → chart in B/M/K units; percent → 0–100 points; counts untouched.
 */
export function scaleForMetric(
  rawValues: number[],
  kind: ScaleKind
): ScaledSeries {
  const finite = rawValues.filter((v) => Number.isFinite(v));
  const maxAbs = finite.length
    ? Math.max(...finite.map((v) => Math.abs(v)))
    : 0;

  if (kind === "percent") {
    return {
      values: finite.length
        ? rawValues.map((v) => (Number.isFinite(v) ? v * 100 : 0))
        : [],
      format: (v) => `${Number(v).toFixed(1)}%`,
      unitLabel: "%",
      scale: 100,
    };
  }

  if (kind === "count") {
    return {
      values: rawValues.map((v) => (Number.isFinite(v) ? v : 0)),
      format: countLabel,
      unitLabel: "",
      scale: 1,
    };
  }

  if (kind === "currency") {
    if (maxAbs >= 1_000_000_000) {
      return {
        values: rawValues.map((v) =>
          Number.isFinite(v) ? v / 1_000_000_000 : 0
        ),
        format: (v) => `$${Number(v).toFixed(1)}B`,
        unitLabel: "$B",
        scale: 1_000_000_000,
      };
    }
    if (maxAbs >= 1_000_000) {
      return {
        values: rawValues.map((v) => (Number.isFinite(v) ? v / 1_000_000 : 0)),
        format: (v) => `$${Number(v).toFixed(0)}M`,
        unitLabel: "$M",
        scale: 1_000_000,
      };
    }
    if (maxAbs >= 1_000) {
      return {
        values: rawValues.map((v) => (Number.isFinite(v) ? v / 1_000 : 0)),
        format: (v) => `$${Number(v).toFixed(0)}K`,
        unitLabel: "$K",
        scale: 1_000,
      };
    }
    return {
      values: rawValues.map((v) => (Number.isFinite(v) ? v : 0)),
      format: (v) => `$${Number(v).toFixed(0)}`,
      unitLabel: "$",
      scale: 1,
    };
  }

  return {
    values: rawValues.map((v) => (Number.isFinite(v) ? v : 0)),
    format: (v) => String(Number(v).toFixed(2)),
    unitLabel: "",
    scale: 1,
  };
}

export function metricScaleKind(
  metricKey?: string | null,
  percentFlag?: boolean
): ScaleKind {
  if (
    percentFlag ||
    metricKey === "winRate" ||
    metricKey === "feeExpectedPct"
  ) {
    return "percent";
  }
  if (metricKey === "roundCount") return "count";
  if (
    metricKey === "estimateValue" ||
    metricKey === "feeExpected" ||
    metricKey === "contingencyTotal"
  ) {
    return "currency";
  }
  return "currency";
}

/** Format a raw cell for tables (raw ratios / dollars / counts). */
export function formatTableCell(
  key: string,
  value: string | number | null
): string | number | null {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return humanizeCategory(value);
  if (!Number.isFinite(value)) return "—";

  const k = key.toLowerCase();
  if (
    k.includes("win rate") ||
    k.includes("winrate") ||
    k.includes("fee %") ||
    k.includes("fee%")
  ) {
    // Heuristic: values in (0,1.5] are ratios; larger already percent points.
    const ratio = Math.abs(value) <= 1.5 ? value : value / 100;
    return percentLabel(ratio, k.includes("fee") ? 1 : 0);
  }
  // Counts before currency: "Estimate rounds" contains "estimate" and must not
  // fall into dollarsCompact ($4 for a round count).
  if (
    k.includes("round") ||
    k.includes("count") ||
    k === "rounds" ||
    k.includes("roundcount")
  ) {
    return countLabel(value);
  }
  if (
    k.includes("volume") ||
    k.includes("fee expected") ||
    k.includes("fee $") ||
    k.includes("$") ||
    k.includes("estimate value") ||
    k.includes("pursuit") ||
    k.includes("contingenc") ||
    // Bare "fee" (not already handled as fee %) and bare "estimate" (not rounds)
    (k.includes("fee") && !k.includes("%")) ||
    (k.includes("estimate") && !k.includes("round"))
  ) {
    return dollarsCompact(value);
  }
  if (Math.abs(value) > 0 && Math.abs(value) < 1) {
    return percentLabel(value);
  }
  if (Math.abs(value) >= 1000) return dollarsCompact(value);
  return value;
}
