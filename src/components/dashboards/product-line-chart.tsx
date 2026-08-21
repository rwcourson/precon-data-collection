"use client";

/**
 * Line / area marks the vendor LineAreaChart hides (`dot: false`).
 * Markers stay large enough to read on a single-year series.
 */

import { CHART_COLORS, formatSeriesName } from "@rwcourson/chart-elements";
import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DOT_R = 6;
const ACTIVE_R = 8;
const STROKE_W = 2.75;

export type ProductLineSeries = { key: string; label?: string };

type ProductLineChartProps = {
  data: Record<string, string | number | null>[];
  categoryKey: string;
  series: ProductLineSeries[];
  valueFormatter: (value: number) => string;
  yAxisLabel?: string;
  variant?: "line" | "area";
  showLegend?: boolean;
};

function seriesColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]!;
}

function hasPlottableValue(
  data: Record<string, string | number | null>[],
  keys: string[]
): boolean {
  return data.some((row) =>
    keys.some((key) => {
      const value = row[key];
      return value != null && Number.isFinite(Number(value));
    })
  );
}

function ChartTooltip({
  active,
  label,
  payload,
  formatter,
}: {
  active?: boolean;
  label?: string | number;
  payload?: readonly {
    name?: string;
    value?: number | string;
    color?: string;
  }[];
  formatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-32 rounded-md border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-3 py-2 text-[var(--chart-tooltip-fg)] shadow-[var(--overlay-shadow)]">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-1">
        {payload.map((item) => {
          const numeric = Number(item.value);
          if (!Number.isFinite(numeric)) return null;
          return (
            <li
              key={String(item.name)}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: item.color }}
                />
                {item.name}
              </span>
              <span className="font-mono tabular-nums">
                {formatter(numeric)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProductLineChart({
  data,
  categoryKey,
  series,
  valueFormatter,
  yAxisLabel,
  variant = "line",
  showLegend = true,
}: ProductLineChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const keys = series.map((item) => item.key);
  const labeled = useMemo(
    () =>
      series.map((item) => ({
        key: item.key,
        label: item.label?.trim() || formatSeriesName(item.key),
      })),
    [series]
  );

  if (!data.length || !hasPlottableValue(data, keys)) {
    return (
      <div className="flex h-[240px] w-full items-center justify-center rounded-md border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
        No data for this view.
      </div>
    );
  }

  const Chart = variant === "area" ? AreaChart : LineChart;
  const tick = {
    fill: "var(--muted-foreground)",
    fontSize: 11,
  };

  return (
    <div className="h-full min-h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
          {variant === "area" ? (
            <defs>
              {labeled.map((_, index) => {
                const fillId = `${gradientId}-${index}`;
                return (
                  <linearGradient
                    key={fillId}
                    id={fillId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={seriesColor(index)}
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="100%"
                      stopColor={seriesColor(index)}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                );
              })}
            </defs>
          ) : null}
          <CartesianGrid
            stroke="var(--chart-grid)"
            vertical={false}
            strokeDasharray="0"
          />
          <XAxis
            dataKey={categoryKey}
            tick={tick}
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={yAxisLabel ? 44 : 36}
            tickFormatter={(value: number) =>
              Number.isFinite(value) ? String(value) : ""
            }
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    offset: 8,
                    style: {
                      fill: "var(--muted-foreground)",
                      fontSize: 11,
                    },
                  }
                : undefined
            }
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
            content={<ChartTooltip formatter={valueFormatter} />}
          />
          {showLegend ? (
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
            />
          ) : null}
          {labeled.map((item, index) => {
            const color = seriesColor(index);
            const mark = {
              r: DOT_R,
              strokeWidth: 2,
              fill: color,
              stroke: "var(--card)",
            };
            const activeMark = { ...mark, r: ACTIVE_R };
            if (variant === "area") {
              const fillId = `${gradientId}-${index}`;
              return (
                <Area
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={color}
                  strokeWidth={STROKE_W}
                  fill={`url(#${fillId})`}
                  dot={mark}
                  activeDot={activeMark}
                  connectNulls
                  isAnimationActive
                  animationDuration={550}
                  animationEasing="ease-out"
                />
              );
            }
            return (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={color}
                strokeWidth={STROKE_W}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={mark}
                activeDot={activeMark}
                connectNulls
                isAnimationActive
                animationDuration={550}
                animationEasing="ease-out"
              />
            );
          })}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
