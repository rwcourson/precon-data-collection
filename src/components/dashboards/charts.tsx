"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const LIGHT_COLORS = ["#0c2048", "#3b6db0", "#7aa3d4", "#94a3b8", "#c9762b", "#5f8f5a"];
const DARK_COLORS = ["#93a9d6", "#6b8fc4", "#adbfe4", "#8b9bb0", "#d4a06a", "#7cb087"];

const dollarsCompact = (v: number) =>
  Math.abs(v) >= 1_000_000_000
    ? `$${(v / 1_000_000_000).toFixed(1)}B`
    : Math.abs(v) >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(0)}M`
      : `$${(v / 1_000).toFixed(0)}K`;

function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return useMemo(
    () => ({
      colors: dark ? DARK_COLORS : LIGHT_COLORS,
      grid: dark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
      tick: dark ? "#a2acbd" : "#64748b",
      tooltip: {
        fontSize: 12,
        borderRadius: 8,
        border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0",
        boxShadow: dark
          ? "0 8px 24px rgba(0,0,0,0.35)"
          : "0 4px 16px rgba(15, 23, 42, 0.08)",
        background: dark ? "#1f2839" : "#ffffff",
        padding: "8px 10px",
        color: dark ? "#f4f6fa" : "#334155",
      },
    }),
    [dark],
  );
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
        <XAxis
          dataKey="year"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tick={{ fill: theme.tick }}
        />
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
        <XAxis
          dataKey="year"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tick={{ fill: theme.tick }}
        />
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
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 4 }}
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
        <XAxis
          dataKey="month"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tick={{ fill: theme.tick }}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={52}
          tick={{ fill: theme.tick }}
          tickFormatter={dollarsCompact}
        />
        <Tooltip
          cursor={false}
          formatter={(v) => dollarsCompact(Number(v))}
          contentStyle={theme.tooltip}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: theme.tick }} />
        <Line
          type="monotone"
          dataKey="objective"
          name="Objective (100% win)"
          stroke={theme.colors[0]}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 4 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="adjusted"
          name="Risk-adjusted"
          stroke={theme.colors[4]}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 4 }}
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
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.grid} />
        <XAxis
          type="number"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={dollarsCompact}
          tick={{ fill: theme.tick }}
        />
        <YAxis
          type="category"
          dataKey="name"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={150}
          tick={{ fill: theme.tick }}
        />
        <Tooltip
          cursor={false}
          formatter={(v) => dollarsCompact(Number(v))}
          contentStyle={theme.tooltip}
        />
        <Bar
          dataKey="volume"
          name="Pursuit Volume"
          fill={theme.colors[0]}
          radius={[0, 3, 3, 0]}
          barSize={22}
          activeBar={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
