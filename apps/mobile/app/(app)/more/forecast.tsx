import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Text } from "@/src/components/ui/Text";
import { PreconBarChart, PreconDualLineChart } from "@/src/components/charts/PreconCharts";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";
import {
  formatCompactDollars,
  formatKpiValue,
} from "@/src/lib/mobile-data-display";
import { normalizeForecastMonths } from "@/src/lib/mobile-chart-adapters";

type ForecastSeries = {
  months?: { month: string; objective: number; adjusted: number }[];
};

export default function ForecastScreen() {
  const { colors } = useTheme();
  const [series, setSeries] = useState<ForecastSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyLabel, setEmpty] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{
          series: ForecastSeries;
          empty?: boolean;
          emptyLabel?: string;
        }>("/api/v1/mobile/forecast");
        setSeries(res.series);
        if (res.empty) setEmpty(res.emptyLabel ?? "No forecast points yet");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const points = useMemo(
    () => normalizeForecastMonths(series?.months, { max: 12 }),
    [series],
  );

  const totals = useMemo(() => {
    let obj = 0;
    let adj = 0;
    for (const p of points) {
      obj += p.value;
      adj += p.value2 ?? 0;
    }
    return { obj, adj };
  }, [points]);

  // Bar of objective alone for scannable monthly volume
  const barPoints = useMemo(
    () =>
      points.map((p, i) => ({
        label: p.label,
        value: p.value,
        color: undefined as string | undefined,
      })),
    [points],
  );

  return (
    <Screen>
      <GlassHeader title="Forecast" subtitle="Objective vs risk-adjusted" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : emptyLabel || points.length === 0 ? (
        <EmptyState message={emptyLabel ?? "No forecast points yet"} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          <View style={styles.kpiRow}>
            <GlassCard style={styles.kpi}>
              <Text muted variant="micro">
                Objective (window)
              </Text>
              <Text variant="headline" style={{ color: colors.brand, marginTop: 4 }}>
                {formatCompactDollars(totals.obj)}
              </Text>
            </GlassCard>
            <GlassCard style={styles.kpi}>
              <Text muted variant="micro">
                Risk-adjusted
              </Text>
              <Text variant="headline" style={{ color: colors.brand, marginTop: 4 }}>
                {formatCompactDollars(totals.adj)}
              </Text>
            </GlassCard>
          </View>

          <PreconDualLineChart
            title="Monthly curves"
            subtitle={`${points.length} months · area dual series`}
            points={points}
            series1Name="Objective"
            series2Name="Adjusted"
            valueFormat="dollars"
          />

          <PreconBarChart
            title="Objective by month"
            subtitle="Same live forecast series"
            points={barPoints}
            valueFormat="dollars"
          />

          <GlassCard>
            <Text muted variant="caption">
              Built from the same workspace rounds as the web forecast deck (
              {formatKpiValue(points.length, "number")} months shown). Export remains on web for
              full slide decks.
            </Text>
          </GlassCard>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  kpi: { flex: 1, marginBottom: 0 },
});
