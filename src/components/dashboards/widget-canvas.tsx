"use client";

import {
  AreaMetricChart,
  CeDataTable,
  ComboMetricChart,
  HorizontalBarChart,
  KpiMetricCard,
  MetricLineChart,
  PieDonutMetricChart,
  StackedBarChart,
  VerticalBarChart,
  WaterfallMetricChart,
} from "@/components/dashboards/ce-charts";
import { Badge } from "@/components/ui/badge";
import type { WidgetResolved } from "@/lib/dashboard-query";
import { cn } from "@/lib/utils";

function spanClass(w?: number) {
  if (!w || w >= 12) return "lg:col-span-12";
  if (w >= 9) return "lg:col-span-9";
  if (w >= 8) return "lg:col-span-8";
  if (w >= 6) return "lg:col-span-6";
  if (w >= 4) return "lg:col-span-4";
  if (w >= 3) return "lg:col-span-3";
  return "lg:col-span-6";
}

function isPercentMetric(metricKey?: string | null) {
  return metricKey === "winRate" || metricKey === "feeExpectedPct";
}

function kindLabel(kind: string) {
  return kind.replaceAll("_", " ");
}

function metricSubtitle(metricKey?: string | null, groupBy?: string | null) {
  const metricLabels: Record<string, string> = {
    estimateValue: "Pursuit volume",
    feeExpected: "Expected fee",
    feeExpectedPct: "Fee %",
    contingencyTotal: "Contingency",
    roundCount: "Estimate rounds",
    winRate: "Win rate",
  };
  const groupLabels: Record<string, string> = {
    region: "Region",
    preconDepartment: "Department",
    marketSector: "Market sector",
    estimatePhase: "Phase",
    bidYear: "Bid year",
    status: "Status",
    outcome: "Outcome",
    sizeBucket: "Size band",
  };
  const m = metricKey ? (metricLabels[metricKey] ?? metricKey) : null;
  const g = groupBy ? (groupLabels[groupBy] ?? groupBy) : null;
  if (m && g) return `${m} · by ${g}`;
  if (m) return m;
  return null;
}

export function WidgetCanvas({
  widgets,
  className,
  loading,
}: {
  widgets: WidgetResolved[];
  className?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-12", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-40 animate-pulse rounded-lg border bg-muted/40",
              i < 4 ? "lg:col-span-3" : "lg:col-span-6",
            )}
          />
        ))}
      </div>
    );
  }

  if (!widgets.length) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        No widgets yet — describe a view in Magnus or add one in Studio.
      </div>
    );
  }

  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-12", className)}
      data-chart-palette="cobalt"
    >
      {widgets.map((w, idx) => {
        const kind = w.config.kind;
        const percent = isPercentMetric(w.config.metricKey);
        const wide = kind === "kpi";
        const subtitle = metricSubtitle(w.config.metricKey, w.config.groupBy);
        return (
          <article
            key={`${w.config.title}-${idx}`}
            className={cn(
              "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card shadow-[var(--card-shadow,0_1px_0_rgb(15_23_42/0.04))]",
              wide ? "sm:col-span-1 lg:col-span-3" : spanClass(w.config.layout?.w),
            )}
          >
            <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <h3 className="truncate text-[13px] font-semibold leading-snug tracking-tight text-foreground">
                  {w.config.title}
                </h3>
                {subtitle && (
                  <p className="truncate text-2xs text-muted-foreground">{subtitle}</p>
                )}
              </div>
              <Badge
                variant="secondary"
                size="sm"
                className="shrink-0 capitalize text-2xs font-medium"
              >
                {kindLabel(kind)}
              </Badge>
            </header>
            <div className={cn("min-h-0 flex-1", kind === "kpi" ? "p-3" : "p-3.5 pt-3")}>
              {w.empty ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No data for this filter.
                </p>
              ) : kind === "kpi" && w.kpi ? (
                <KpiMetricCard
                  label={w.config.title}
                  value={w.kpi.value}
                  sub={w.kpi.sub}
                  raw={w.kpi.raw}
                  percent={percent}
                />
              ) : kind === "pie" || kind === "donut" ? (
                <PieDonutMetricChart
                  data={(w.series ?? []).map((s) => ({ name: s.name, value: s.value }))}
                  donut={kind === "donut"}
                  percent={percent}
                />
              ) : kind === "horizontal_bar" ? (
                <HorizontalBarChart data={w.series ?? []} percent={percent} />
              ) : kind === "bar" ? (
                <VerticalBarChart
                  data={(w.series ?? []).map((s) => ({ name: s.name, value: s.value }))}
                  percent={percent}
                />
              ) : kind === "stacked_bar" && w.stacked ? (
                <StackedBarChart data={w.stacked.rows} series={w.stacked.series} />
              ) : kind === "area" ? (
                <AreaMetricChart data={w.trend ?? []} percent={percent} />
              ) : kind === "line" || kind === "projection" ? (
                <MetricLineChart
                  data={w.trend ?? []}
                  lines={
                    w.trendKeys ?? [{ key: "value", label: w.config.metricKey ?? "Value" }]
                  }
                  percent={percent && (w.trendKeys?.length ?? 1) === 1}
                />
              ) : kind === "combo" && w.combo ? (
                <ComboMetricChart
                  rows={w.combo.rows}
                  categoryKey={w.combo.categoryKey}
                  barKeys={w.combo.barKeys}
                  lineKeys={w.combo.lineKeys}
                />
              ) : kind === "waterfall" && w.waterfall ? (
                <WaterfallMetricChart points={w.waterfall.points} />
              ) : kind === "table" || kind === "reconciliation" ? (
                <div className="max-h-96 overflow-auto rounded-md border border-border/60">
                  <CeDataTable
                    columns={w.table?.columns ?? []}
                    rows={w.table?.rows ?? []}
                    caption={w.config.title}
                  />
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Unsupported widget kind: {kind}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
