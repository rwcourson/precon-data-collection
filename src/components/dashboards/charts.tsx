"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* B&G chart series — navy / steel / copper / forest (no purple). */
const LIGHT_COLORS = ["#0c2048", "#2456a0", "#5b8ac9", "#c9762b", "#5f8f5a", "#4a6fa5", "#8a9bb0"];
const DARK_COLORS = ["#93a9d6", "#6b8fc4", "#adbfe4", "#d4a06a", "#7cb087", "#b8c8e4", "#8b9bb0"];

export const dollarsCompact = (v: number) =>
  Math.abs(v) >= 1_000_000_000
    ? `$${(v / 1_000_000_000).toFixed(1)}B`
    : Math.abs(v) >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(0)}M`
      : Math.abs(v) >= 1_000
        ? `$${(v / 1_000).toFixed(0)}K`
        : `$${v.toFixed(0)}`;

function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return useMemo(
    () => ({
      colors: dark ? DARK_COLORS : LIGHT_COLORS,
      grid: dark ? "rgba(173,191,228,0.12)" : "#dce4f0",
      tick: dark ? "#adbfe4" : "#4a5d7a",
      muted: dark ? "#6b7a94" : "#8a9bb0",
      tooltip: {
        fontSize: 12,
        borderRadius: 6,
        border: dark ? "1px solid rgba(147,169,214,0.22)" : "1px solid #d5deec",
        boxShadow: dark
          ? "0 10px 28px rgba(10, 22, 40, 0.45)"
          : "0 6px 20px rgba(12, 32, 72, 0.1)",
        background: dark ? "#1f2839" : "#ffffff",
        padding: "8px 10px",
        color: dark ? "#f4f6fa" : "#0c2048",
      },
    }),
    [dark],
  );
}

function formatValue(v: number, percent?: boolean) {
  if (percent) return `${(v * 100).toFixed(1)}%`;
  if (Math.abs(v) <= 1 && v !== 0 && Math.abs(v) < 0.5) return `${(v * 100).toFixed(1)}%`;
  return dollarsCompact(v);
}

export function VolumeByYearChart({
  data,
  series,
}: {
  data: Record<string, number | string>[];
  series: string[];
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
        <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: theme.tick }} />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={dollarsCompact}
          width={52}
          tick={{ fill: theme.tick }}
        />
        <Tooltip cursor={false} formatter={(v) => dollarsCompact(Number(v))} contentStyle={theme.tooltip} />
        <Legend wrapperStyle={{ fontSize: 12, color: theme.tick }} />
        {series.map((s, i) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="v"
            fill={theme.colors[i % theme.colors.length]}
            radius={i === series.length - 1 ? [3, 3, 0, 0] : 0}
            activeBar={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
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
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
        <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: theme.tick }} />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fill: theme.tick }}
          tickFormatter={(v) =>
            percent ? `${(Number(v) * 100).toFixed(0)}%` : dollarsCompact(Number(v))
          }
        />
        <Tooltip
          cursor={false}
          formatter={(v) =>
            percent ? `${(Number(v) * 100).toFixed(1)}%` : dollarsCompact(Number(v))
          }
          contentStyle={theme.tooltip}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: theme.tick }} />
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={theme.colors[i % theme.colors.length]}
            strokeWidth={2.25}
            dot={{ r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ForecastVolumeChart({
  data,
}: {
  data: { month: string; objective: number; adjusted: number }[];
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
        <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: theme.tick }} />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={52}
          tick={{ fill: theme.tick }}
          tickFormatter={dollarsCompact}
        />
        <Tooltip cursor={false} formatter={(v) => dollarsCompact(Number(v))} contentStyle={theme.tooltip} />
        <Legend wrapperStyle={{ fontSize: 12, color: theme.tick }} />
        <Line
          type="monotone"
          dataKey="objective"
          name="Objective (100% win)"
          stroke={theme.colors[0]}
          strokeWidth={2.25}
          dot={{ r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="adjusted"
          name="Risk-adjusted"
          stroke={theme.colors[3]}
          strokeWidth={2.25}
          dot={{ r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
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
  const theme = useChartTheme();
  const height = Math.max(220, Math.min(480, data.length * 42 + 40));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.grid} />
        <XAxis
          type="number"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatValue(Number(v), percent)}
          tick={{ fill: theme.tick }}
        />
        <YAxis
          type="category"
          dataKey="name"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={128}
          tick={{ fill: theme.tick }}
        />
        <Tooltip
          cursor={{ fill: theme.grid }}
          formatter={(v) => formatValue(Number(v), percent)}
          contentStyle={theme.tooltip}
        />
        <Bar
          dataKey="value"
          name={valueLabel}
          fill={theme.colors[0]}
          radius={[0, 4, 4, 0]}
          barSize={20}
          activeBar={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VerticalBarChart({
  data,
  percent,
}: {
  data: { name: string; value: number }[];
  percent?: boolean;
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="name"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tick={{ fill: theme.tick }}
          interval={0}
          angle={data.length > 6 ? -28 : 0}
          textAnchor={data.length > 6 ? "end" : "middle"}
          height={data.length > 6 ? 56 : 28}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={52}
          tick={{ fill: theme.tick }}
          tickFormatter={(v) => formatValue(Number(v), percent)}
        />
        <Tooltip
          cursor={false}
          formatter={(v) => formatValue(Number(v), percent)}
          contentStyle={theme.tooltip}
        />
        <Bar dataKey="value" fill={theme.colors[1]} radius={[4, 4, 0, 0]} barSize={28} activeBar={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StackedBarChart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: string[];
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
        <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: theme.tick }} />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={dollarsCompact}
          width={52}
          tick={{ fill: theme.tick }}
        />
        <Tooltip cursor={false} formatter={(v) => dollarsCompact(Number(v))} contentStyle={theme.tooltip} />
        <Legend wrapperStyle={{ fontSize: 12, color: theme.tick }} />
        {series.map((s, i) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="s"
            fill={theme.colors[i % theme.colors.length]}
            radius={i === series.length - 1 ? [3, 3, 0, 0] : 0}
            activeBar={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
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
  const theme = useChartTheme();
  const gradId = `area-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.colors[1]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={theme.colors[1]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
        <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: theme.tick }} />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={52}
          tick={{ fill: theme.tick }}
          tickFormatter={(v) => formatValue(Number(v), percent)}
        />
        <Tooltip
          cursor={false}
          formatter={(v) => formatValue(Number(v), percent)}
          contentStyle={theme.tooltip}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={theme.colors[1]}
          strokeWidth={2.25}
          fill={`url(#${gradId})`}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PieDonutChart({
  data,
  donut,
  percent,
}: {
  data: { name: string; value: number }[];
  donut?: boolean;
  percent?: boolean;
}) {
  const theme = useChartTheme();
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Tooltip
            formatter={(v) => formatValue(Number(v), percent)}
            contentStyle={theme.tooltip}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ fontSize: 11, color: theme.tick }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="46%"
            innerRadius={donut ? 62 : 0}
            outerRadius={96}
            paddingAngle={donut ? 2 : 1}
            stroke="transparent"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={theme.colors[i % theme.colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {donut && total > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] text-center">
          <p className="text-lg font-semibold tracking-tight tabular-nums">
            {formatValue(total, percent)}
          </p>
          <p className="text-2xs text-muted-foreground">Total</p>
        </div>
      )}
    </div>
  );
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
