/**
 * Pure chart adapters for mobile — normalize mobile API series into plot points.
 * Palette intent from chart-elements "B&G Time" (navy / steel / copper family).
 * Mirrored at apps/mobile/src/lib/mobile-chart-adapters.ts — keep in sync.
 */

/** B&G Time series palette (light) — chart-elements bg-time swatches + steel. */
export const BG_SERIES_LIGHT = [
  "#0c2048", // navy
  "#315fbb", // steel blue
  "#1f6b4a", // forest
  "#8a5010", // copper
  "#9c343c", // brick
  "#93a9d6", // steel mid
  "#5f8f5a", // success green
  "#3d5a8c", // info
] as const;

/** Dark-mode series — lifted navy/steel for contrast on canvas. */
export const BG_SERIES_DARK = [
  "#a8bce8",
  "#7a9fd4",
  "#8bc986",
  "#e0a05c",
  "#e07a6c",
  "#93a9d6",
  "#a8d4a4",
  "#8aa4d4",
] as const;

export type ChartPoint = {
  label: string;
  value: number;
  /** Optional second series (e.g. forecast adjusted). */
  value2?: number;
  color?: string;
};

export type ChartSeriesInput = {
  label: string;
  value: number | null | undefined;
};

export function seriesColorAt(index: number, dark = false): string {
  const palette = dark ? BG_SERIES_DARK : BG_SERIES_LIGHT;
  const n = palette.length;
  return palette[((Math.trunc(index) % n) + n) % n]!;
}

/** Finite non-negative plot value. */
export function toPlotValue(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return v;
}

export function isEmptySeries(points: ChartPoint[]): boolean {
  if (!points.length) return true;
  return points.every(
    (p) => toPlotValue(p.value) === 0 && toPlotValue(p.value2) === 0
  );
}

/** Shorten axis labels for mobile density. */
export function shortLabel(label: string, max = 8): string {
  const t = String(label ?? "")
    .replace(/_/g, " ")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Normalize statusSeries / KPI number series from mobile dashboards API.
 * Multi-color bars via palette index.
 */
export function normalizeStatusSeries(
  series: ChartSeriesInput[] | null | undefined,
  opts?: { dark?: boolean; max?: number }
): ChartPoint[] {
  const max = opts?.max ?? 8;
  const dark = opts?.dark ?? false;
  if (!series?.length) return [];
  return series
    .filter(
      (s) =>
        s != null && Number.isFinite(Number(s.value)) && Number(s.value) > 0
    )
    .slice(0, max)
    .map((s, i) => ({
      label: shortLabel(s.label, 10),
      value: toPlotValue(s.value),
      color: seriesColorAt(i, dark),
    }));
}

/**
 * Forecast months from GET /api/v1/mobile/forecast → dual series points.
 * value = objective, value2 = adjusted.
 */
export function normalizeForecastMonths(
  months:
    | { month: string; objective: number; adjusted: number }[]
    | null
    | undefined,
  opts?: { max?: number }
): ChartPoint[] {
  const max = opts?.max ?? 12;
  if (!months?.length) return [];
  // Prefer most recent window for mobile readability
  const slice = months.length > max ? months.slice(-max) : months;
  return slice.map((m) => {
    const raw = String(m.month ?? "");
    // 2025-06 → 06 or Jun
    const mm = raw.length >= 7 ? raw.slice(5, 7) : raw.slice(-2);
    return {
      label: mm,
      value: toPlotValue(m.objective),
      value2: toPlotValue(m.adjusted),
    };
  });
}

/** Overview byStatus map → chart points. */
export function normalizeByStatusMap(
  byStatus: Record<string, number> | null | undefined,
  opts?: { dark?: boolean }
): ChartPoint[] {
  if (!byStatus) return [];
  return normalizeStatusSeries(
    Object.entries(byStatus).map(([label, value]) => ({ label, value })),
    { dark: opts?.dark, max: 8 }
  );
}

/**
 * Region volume series for dashboard multi-bar (from thin API regionVolume).
 */
export function normalizeRegionVolume(
  series: { label: string; value: number }[] | null | undefined,
  opts?: { dark?: boolean; max?: number }
): ChartPoint[] {
  return normalizeStatusSeries(series ?? [], {
    dark: opts?.dark,
    max: opts?.max ?? 6,
  });
}

export function chartMaxValue(points: ChartPoint[], useValue2 = false): number {
  let m = 1;
  for (const p of points) {
    m = Math.max(m, toPlotValue(p.value));
    if (useValue2) m = Math.max(m, toPlotValue(p.value2));
  }
  return m * 1.12;
}

/**
 * gifted-charts formatYLabel receives the stringified axis tick.
 * Compact dollars for large magnitudes; plain numbers otherwise.
 */
export function formatAxisTick(
  label: string,
  mode: "dollars" | "number" | "auto" = "auto"
): string {
  const n = Number(String(label).replace(/,/g, ""));
  if (!Number.isFinite(n)) return label;
  const useDollars =
    mode === "dollars" || (mode === "auto" && Math.abs(n) >= 10_000);
  if (useDollars) {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000_000)
      return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${Math.round(abs)}`;
  }
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}
