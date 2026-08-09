import { useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-gifted-charts";
import { useTheme } from "@/src/theme/ThemeContext";
import {
  chartMaxValue,
  formatAxisTick,
  isEmptySeries,
  seriesColorAt,
  type ChartPoint,
} from "@/src/lib/mobile-chart-adapters";
import { ChartFrame } from "./ChartFrame";

function useChartWidth() {
  const { width } = useWindowDimensions();
  return Math.min(Math.max(width - 64, 280), 360);
}

type ValueFormat = "dollars" | "number" | "auto";

/** Multi-color categorical bars — dashboard status / group volume. */
export function PreconBarChart({
  title,
  subtitle,
  points,
  emptyLabel,
  valueFormat = "auto",
}: {
  title: string;
  subtitle?: string;
  points: ChartPoint[];
  emptyLabel?: string;
  /** dollars → $31.0B ticks; number → plain; auto → $ when |n|≥10k */
  valueFormat?: ValueFormat;
}) {
  const { colors, isDark } = useTheme();
  const chartWidth = useChartWidth();
  const empty = isEmptySeries(points);
  const data = useMemo(
    () =>
      points.map((p, i) => ({
        value: Math.max(0, p.value),
        label: p.label,
        frontColor: p.color ?? seriesColorAt(i, isDark),
      })),
    [points, isDark],
  );

  return (
    <ChartFrame title={title} subtitle={subtitle} empty={empty} emptyLabel={emptyLabel}>
      <BarChart
        data={data}
        barWidth={Math.min(28, Math.floor(chartWidth / Math.max(data.length * 2.2, 8)))}
        spacing={12}
        roundedTop
        roundedBottom
        hideRules={false}
        xAxisThickness={1}
        yAxisThickness={0}
        yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
        rulesColor={colors.border}
        noOfSections={4}
        maxValue={chartMaxValue(points)}
        height={168}
        width={chartWidth}
        yAxisLabelWidth={48}
        formatYLabel={(lab) => formatAxisTick(lab, valueFormat)}
        isAnimated
        animationDuration={600}
      />
    </ChartFrame>
  );
}

/** Dual line — forecast objective vs risk-adjusted. */
export function PreconDualLineChart({
  title,
  subtitle,
  points,
  series1Name = "Objective",
  series2Name = "Adjusted",
  emptyLabel,
  valueFormat = "dollars",
}: {
  title: string;
  subtitle?: string;
  points: ChartPoint[];
  series1Name?: string;
  series2Name?: string;
  emptyLabel?: string;
  valueFormat?: ValueFormat;
}) {
  const { colors, isDark } = useTheme();
  const chartWidth = useChartWidth();
  const empty = isEmptySeries(points);
  const c1 = seriesColorAt(0, isDark);
  const c2 = seriesColorAt(3, isDark);

  const data1 = useMemo(
    () =>
      points.map((p) => ({
        value: Math.max(0, p.value),
        label: p.label,
      })),
    [points],
  );
  const data2 = useMemo(
    () =>
      points.map((p) => ({
        value: Math.max(0, p.value2 ?? 0),
      })),
    [points],
  );

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      empty={empty}
      emptyLabel={emptyLabel}
      legend={[
        { label: series1Name, color: c1 },
        { label: series2Name, color: c2 },
      ]}
    >
      <LineChart
        data={data1}
        data2={data2}
        height={180}
        width={chartWidth}
        spacing={Math.max(28, Math.floor(chartWidth / Math.max(points.length, 4)))}
        initialSpacing={12}
        color1={c1}
        color2={c2}
        thickness={2.5}
        thickness2={2.5}
        hideDataPoints={points.length > 10}
        dataPointsColor1={c1}
        dataPointsColor2={c2}
        dataPointsRadius={3}
        startFillColor1={c1}
        startFillColor2={c2}
        endFillColor1={c1}
        endFillColor2={c2}
        startOpacity={0.18}
        endOpacity={0.02}
        startOpacity2={0.12}
        endOpacity2={0.02}
        areaChart
        areaChart2
        yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
        rulesColor={colors.border}
        yAxisColor={colors.border}
        xAxisColor={colors.border}
        noOfSections={4}
        maxValue={chartMaxValue(points, true)}
        yAxisLabelWidth={48}
        formatYLabel={(lab) => formatAxisTick(lab, valueFormat)}
        isAnimated
        curved
      />
    </ChartFrame>
  );
}

/** Donut / pie for share-of-total (status mix). */
export function PreconDonutChart({
  title,
  subtitle,
  points,
  emptyLabel,
}: {
  title: string;
  subtitle?: string;
  points: ChartPoint[];
  emptyLabel?: string;
}) {
  const { isDark } = useTheme();
  const empty = isEmptySeries(points);
  const pieData = useMemo(
    () =>
      points.map((p, i) => ({
        value: Math.max(0, p.value),
        color: p.color ?? seriesColorAt(i, isDark),
        text: p.label,
      })),
    [points, isDark],
  );
  const total = pieData.reduce((s, p) => s + p.value, 0);

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      empty={empty || total <= 0}
      emptyLabel={emptyLabel}
      legend={pieData.slice(0, 6).map((p) => ({
        label: `${p.text}`,
        color: p.color,
      }))}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <PieChart
          data={pieData}
          donut
          radius={78}
          innerRadius={48}
          innerCircleColor={isDark ? "#161e2e" : "#F4F7FB"}
          centerLabelComponent={() => null}
          showText={false}
          focusOnPress
        />
      </View>
    </ChartFrame>
  );
}
