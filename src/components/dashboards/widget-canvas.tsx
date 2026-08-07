"use client";

import {
  AreaMetricChart,
  HorizontalBarChart,
  MetricLineChart,
  PieDonutChart,
  StackedBarChart,
  VerticalBarChart,
} from "@/components/dashboards/charts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDollars, fmtNumber, fmtPercent } from "@/lib/format";
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

function cellValue(col: string, v: string | number | null) {
  if (v == null) return "—";
  if (typeof v !== "number") return v;
  if (col.includes("%") || col.toLowerCase().includes("rate")) return fmtPercent(v);
  if (col.toLowerCase().includes("round")) return fmtNumber(v);
  if (
    col.includes("$") ||
    col.toLowerCase().includes("volume") ||
    col.toLowerCase().includes("fee") ||
    col.toLowerCase().includes("contingency")
  ) {
    return fmtDollars(v, true);
  }
  return fmtNumber(v);
}

export function WidgetCanvas({
  widgets,
  className,
}: {
  widgets: WidgetResolved[];
  className?: string;
}) {
  if (!widgets.length) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        No widgets yet — describe a view in Copilot or add one in Studio.
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-12", className)}>
      {widgets.map((w, idx) => {
        const kind = w.config.kind;
        const percent = isPercentMetric(w.config.metricKey);
        const wide = kind === "kpi";
        return (
          <article
            key={`${w.config.title}-${idx}`}
            className={cn(
              "overflow-hidden rounded-lg border bg-card shadow-[0_1px_0_rgba(15,23,42,0.04)]",
              wide ? "sm:col-span-1 lg:col-span-3" : spanClass(w.config.layout?.w),
            )}
          >
            <header className="flex items-start justify-between gap-2 border-b px-3.5 py-2.5">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium tracking-tight">{w.config.title}</h3>
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  {w.config.metricKey ?? "metric"}
                  {w.config.groupBy ? ` · by ${w.config.groupBy}` : ""}
                </p>
              </div>
              <Badge variant="outline" size="sm" className="shrink-0 capitalize">
                {kind.replaceAll("_", " ")}
              </Badge>
            </header>
            <div className="p-3">
              {w.empty ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No data for this filter.</p>
              ) : kind === "kpi" && w.kpi ? (
                <div className="px-1 py-3">
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">{w.kpi.value}</p>
                  {w.kpi.sub && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{w.kpi.sub}</p>
                  )}
                </div>
              ) : kind === "pie" || kind === "donut" ? (
                <PieDonutChart
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
              ) : kind === "table" || kind === "reconciliation" ? (
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {(w.table?.columns ?? []).map((c) => (
                          <TableHead key={c} className="text-2xs">
                            {c}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(w.table?.rows ?? []).map((row, i) => (
                        <TableRow key={i}>
                          {(w.table?.columns ?? []).map((c) => (
                            <TableCell key={c} className="text-xs tabular-nums">
                              {cellValue(c, row[c] ?? null)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <HorizontalBarChart data={w.series ?? []} percent={percent} />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
