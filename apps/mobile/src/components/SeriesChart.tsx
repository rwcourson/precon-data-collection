/**
 * Backward-compatible bar chart wrapper — prefer PreconBarChart / PreconDualLineChart.
 */
import { PreconBarChart } from "@/src/components/charts/PreconCharts";
import type { ChartPoint } from "@/src/lib/mobile-chart-adapters";

export type SeriesPoint = ChartPoint;

export function SeriesChart({
  title,
  points,
  emptyLabel = "No series data",
}: {
  title?: string;
  points: SeriesPoint[];
  emptyLabel?: string;
}) {
  return (
    <PreconBarChart
      title={title ?? "Series"}
      points={points}
      emptyLabel={emptyLabel}
    />
  );
}
