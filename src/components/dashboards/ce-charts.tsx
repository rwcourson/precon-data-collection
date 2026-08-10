"use client";

/**
 * Precon adapters over @rwcourson/chart-elements (cobalt palette).
 * Values are pre-scaled so axes stay readable (CE only formats tooltips).
 */

import {
  BarColumnChart,
  ChartFrame,
  LineAreaChart,
  PieDonutChart,
} from "@rwcourson/chart-elements/charts";
import { ModernCard } from "@rwcourson/chart-elements/cards";
import { DataTable } from "@rwcourson/chart-elements/tables";
import { cn } from "@/lib/utils";
import {
  dollarsCompact,
  formatTableCell,
  humanizeCategory,
  metricScaleKind,
  scaleForMetric,
  type ScaleKind,
} from "@/components/dashboards/chart-format";

export { dollarsCompact };

function kindFromPercent(percent?: boolean): ScaleKind {
  return percent ? "percent" : "currency";
}

export function CeChartShell({
  title,
  description,
  height = 280,
  className,
  children,
}: {
  title?: string;
  description?: string;
  height?: number | "auto";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ChartFrame
      title={title}
      description={description}
      height={height}
      className={cn("border-0 bg-transparent shadow-none", className)}
    >
      {children}
    </ChartFrame>
  );
}

export function VolumeByYearChart({
  data,
  series,
}: {
  data: Record<string, number | string>[];
  series: string[];
}) {
  const raw = data.flatMap((row) => series.map((s) => Number(row[s] ?? 0)));
  const scaled = scaleForMetric(raw, "currency");
  const rows = data.map((row, ri) => {
    const next: Record<string, string | number | null> = {
      year: String(row.year ?? ""),
    };
    series.forEach((s, si) => {
      next[s] = scaled.values[ri * series.length + si] ?? 0;
    });
    return next;
  });
  return (
    <div className="h-[300px] w-full min-h-[240px]">
      <BarColumnChart
        data={rows}
        categoryKey="year"
        seriesKeys={series}
        variant="stacked-column"
        valueFormatter={scaled.format}
        showLegend
        yAxisLabel={scaled.unitLabel || undefined}
      />
    </div>
  );
}

export function TrendChart({
  data,
  lines,
  percent,
}: {
  data: Record<string, number | string | null>[];
  lines: { key: string; label: string }[];
  percent?: boolean;
}) {
  const seriesKeys = lines.map((l) => l.key);
  const raw = data.flatMap((row) =>
    seriesKeys.map((key) => {
      const v = row[key];
      return v == null ? 0 : Number(v);
    }),
  );
  const scaled = scaleForMetric(raw, kindFromPercent(percent));
  const rows = data.map((row, ri) => {
    const next: Record<string, string | number | null> = {
      year: String(row.year ?? row.name ?? ""),
    };
    seriesKeys.forEach((key, ki) => {
      const idx = ri * seriesKeys.length + ki;
      const source = row[key];
      next[key] = source == null ? null : (scaled.values[idx] ?? 0);
    });
    return next;
  });
  return (
    <div className="h-[300px] w-full min-h-[240px]">
      <LineAreaChart
        data={rows}
        categoryKey="year"
        seriesKeys={seriesKeys}
        variant="line"
        showLegend={lines.length > 1}
        valueFormatter={scaled.format}
        yAxisLabel={scaled.unitLabel || undefined}
        missingValues="connect"
      />
    </div>
  );
}

export function ForecastVolumeChart({
  data,
}: {
  data: { month: string; objective: number; adjusted: number }[];
}) {
  const raw = data.flatMap((d) => [d.objective, d.adjusted]);
  const scaled = scaleForMetric(raw, "currency");
  const rows = data.map((d, i) => ({
    month: d.month,
    objective: scaled.values[i * 2] ?? 0,
    adjusted: scaled.values[i * 2 + 1] ?? 0,
  }));
  return (
    <div className="h-[320px] w-full min-h-[260px]">
      <LineAreaChart
        data={rows}
        categoryKey="month"
        seriesKeys={["objective", "adjusted"]}
        variant="line"
        showLegend
        valueFormatter={scaled.format}
        yAxisLabel={scaled.unitLabel || undefined}
        missingValues="connect"
      />
    </div>
  );
}

export function VolumeByGroupChart({
  data,
}: {
  data: { name: string; volume: number; rounds: number }[];
}) {
  return (
    <HorizontalBarChart
      data={data.map((d) => ({ name: d.name, value: d.volume, secondary: d.rounds }))}
      valueLabel="Pursuit Volume"
    />
  );
}

export function HorizontalBarChart({
  data,
  valueLabel = "Value",
  percent,
}: {
  data: { name: string; value: number; secondary?: number }[];
  valueLabel?: string;
  percent?: boolean;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const scaled = scaleForMetric(
    sorted.map((d) => d.value),
    kindFromPercent(percent),
  );
  const height = Math.max(240, Math.min(520, sorted.length * 44 + 48));
  return (
    <div className="w-full" style={{ height }}>
      <BarColumnChart
        data={sorted.map((d, i) => ({
          name: humanizeCategory(d.name),
          [valueLabel]: scaled.values[i] ?? 0,
        }))}
        categoryKey="name"
        seriesKeys={[valueLabel]}
        variant="clustered-bar"
        valueFormatter={scaled.format}
        showLegend={false}
        xAxisLabel={scaled.unitLabel || undefined}
      />
    </div>
  );
}

export function VerticalBarChart({
  data,
  percent,
}: {
  data: { name: string; value: number }[];
  percent?: boolean;
}) {
  const scaled = scaleForMetric(
    data.map((d) => d.value),
    kindFromPercent(percent),
  );
  return (
    <div className="h-[300px] w-full min-h-[240px]">
      <BarColumnChart
        data={data.map((d, i) => ({
          name: humanizeCategory(d.name),
          value: scaled.values[i] ?? 0,
        }))}
        categoryKey="name"
        seriesKeys={["value"]}
        variant="clustered-column"
        valueFormatter={scaled.format}
        showLegend={false}
        yAxisLabel={scaled.unitLabel || undefined}
      />
    </div>
  );
}

export function StackedBarChart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: string[];
}) {
  const categoryKey = data[0] && "year" in data[0] ? "year" : "name";
  const raw = data.flatMap((row) => series.map((s) => Number(row[s] ?? 0)));
  const scaled = scaleForMetric(raw, "currency");
  const rows = data.map((row, ri) => {
    const next: Record<string, string | number | null> = {
      [categoryKey]: humanizeCategory(String(row[categoryKey] ?? "")),
    };
    series.forEach((s, si) => {
      next[s] = scaled.values[ri * series.length + si] ?? 0;
    });
    return next;
  });
  return (
    <div className="h-[300px] w-full min-h-[240px]">
      <BarColumnChart
        data={rows}
        categoryKey={categoryKey}
        seriesKeys={series}
        variant="stacked-column"
        valueFormatter={scaled.format}
        showLegend
        yAxisLabel={scaled.unitLabel || undefined}
      />
    </div>
  );
}

export function AreaMetricChart({
  data,
  dataKey = "value",
  percent,
}: {
  data: Record<string, string | number | null>[];
  dataKey?: string;
  percent?: boolean;
}) {
  const raw = data.map((row) =>
    row[dataKey] == null ? 0 : Number(row[dataKey]),
  );
  const scaled = scaleForMetric(raw, kindFromPercent(percent));
  return (
    <div className="h-[300px] w-full min-h-[240px]">
      <LineAreaChart
        data={data.map((row, i) => ({
          year: String(row.year ?? row.name ?? ""),
          [dataKey]: row[dataKey] == null ? null : (scaled.values[i] ?? 0),
        }))}
        categoryKey="year"
        seriesKeys={[dataKey]}
        variant="area"
        showLegend={false}
        valueFormatter={scaled.format}
        yAxisLabel={scaled.unitLabel || undefined}
        missingValues="connect"
      />
    </div>
  );
}

export function PieDonutMetricChart({
  data,
  donut,
}: {
  data: { name: string; value: number }[];
  donut?: boolean;
  percent?: boolean;
}) {
  // Collapse tiny slices + humanize labels so callouts don't pile up.
  const total = data.reduce((s, d) => s + (Number.isFinite(d.value) ? d.value : 0), 0);
  const cleaned = data
    .map((d) => ({ name: humanizeCategory(d.name), value: d.value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const top = cleaned.slice(0, 6);
  const rest = cleaned.slice(6);
  const restSum = rest.reduce((s, d) => s + d.value, 0);
  if (restSum > 0 && total > 0) {
    top.push({ name: "Other", value: restSum });
  }
  return (
    <div className="h-[300px] w-full min-h-[260px] px-1">
      <PieDonutChart
        data={top}
        nameKey="name"
        valueKey="value"
        variant={donut ? "donut" : "pie"}
        // Legend only — slice callouts stack on dense status mixes.
        showLabels={false}
        showLegend
        maxSlices={7}
      />
    </div>
  );
}

/** @deprecated alias — prefer PieDonutMetricChart */
export function PieDonutChartCompat(
  props: Parameters<typeof PieDonutMetricChart>[0],
) {
  return <PieDonutMetricChart {...props} />;
}

export function MetricLineChart({
  data,
  lines,
  percent,
}: {
  data: Record<string, string | number | null>[];
  lines: { key: string; label: string }[];
  percent?: boolean;
}) {
  return <TrendChart data={data} lines={lines} percent={percent} />;
}

export function KpiMetricCard({
  label,
  value,
  sub,
  raw,
  percent,
}: {
  label: string;
  value: string;
  sub?: string;
  raw?: number | null;
  percent?: boolean;
}) {
  const numeric =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : Number(String(value).replace(/[^0-9.-]/g, ""));

  if (Number.isFinite(numeric)) {
    return (
      <ModernCard
        metric={{
          label,
          value: numeric,
          format: percent ? "percent" : Math.abs(numeric) >= 1000 ? "currency" : "number",
          compact: true,
        }}
        size="md"
        className="border-0 bg-transparent shadow-none"
        animate={false}
      />
    );
  }

  return (
    <div className="border-l-2 border-[var(--chart-1)] px-3 py-2.5">
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function CeDataTable({
  columns,
  rows,
  caption,
}: {
  columns: string[];
  rows: Record<string, string | number | null>[];
  caption?: string;
}) {
  return (
    <DataTable
      caption={caption ?? "Dashboard detail"}
      columns={columns.map((c) => ({
        key: c,
        label: c,
        numeric:
          c.includes("$") ||
          c.toLowerCase().includes("volume") ||
          c.toLowerCase().includes("fee") ||
          c.toLowerCase().includes("rate") ||
          c.toLowerCase().includes("round") ||
          c.toLowerCase().includes("%"),
      }))}
      rows={rows.map((row) => {
        const out: Record<string, string | number | null> = {};
        for (const c of columns) {
          out[c] = formatTableCell(c, row[c] ?? null);
        }
        return out;
      })}
    />
  );
}

/** @internal helper for callers that need scale kind from metric key */
export function scaleKindForWidget(metricKey?: string | null, percent?: boolean) {
  return metricScaleKind(metricKey, percent);
}
