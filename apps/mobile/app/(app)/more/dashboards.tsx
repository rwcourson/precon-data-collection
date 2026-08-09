import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Text } from "@/src/components/ui/Text";
import { Chip, ChipRow } from "@/src/components/ui/Chip";
import { ListRow } from "@/src/components/ui/ListRow";
import {
  PreconBarChart,
  PreconDonutChart,
} from "@/src/components/charts/PreconCharts";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatKpiValue } from "@/src/lib/mobile-data-display";
import {
  normalizeRegionVolume,
  normalizeStatusSeries,
} from "@/src/lib/mobile-chart-adapters";

type Level = "corporate" | "region" | "division";

type Kpi = {
  key: string;
  label: string;
  value: number | null;
  format: string;
  group?: string;
};

type DashboardPayload = {
  level: string;
  focusRegion?: string | null;
  groupBy?: string;
  groupVolumeTitle?: string;
  groupVolumeSubtitle?: string;
  kpis: Kpi[];
  headlineMetrics: Kpi[];
  statusSeries?: { label: string; value: number }[];
  groupVolume?: { label: string; value: number }[];
  /** @deprecated prefer groupVolume */
  regionVolume?: { label: string; value: number }[];
  empty?: boolean;
  emptyLabel?: string;
  studio?: { id: number; name: string; scope?: string; published?: boolean }[];
};

const LEVELS: { key: Level; label: string }[] = [
  { key: "corporate", label: "Corporate" },
  { key: "region", label: "Region" },
  { key: "division", label: "Division" },
];

export default function DashboardsScreen() {
  const { colors, isDark } = useTheme();
  const [level, setLevel] = useState<Level>("corporate");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (lvl: Level) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardPayload>(
        `/api/v1/mobile/dashboards?level=${lvl}`,
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(level);
  }, [level, load]);

  const kpis = data?.kpis ?? [];
  const headlines = data?.headlineMetrics ?? [];

  const statusPoints = useMemo(
    () => normalizeStatusSeries(data?.statusSeries, { dark: isDark }),
    [data?.statusSeries, isDark],
  );
  const groupPoints = useMemo(
    () =>
      normalizeRegionVolume(data?.groupVolume ?? data?.regionVolume, {
        dark: isDark,
        max: 6,
      }),
    [data?.groupVolume, data?.regionVolume, isDark],
  );

  const levelLabel = LEVELS.find((l) => l.key === level)?.label ?? level;
  const scopeHint =
    level === "corporate"
      ? "All regions in workspace"
      : data?.focusRegion
        ? `${data.focusRegion} · by ${data.groupBy === "preconDepartment" ? "division" : "market sector"}`
        : levelLabel;

  return (
    <Screen>
      <GlassHeader title="Dashboards" subtitle={`${levelLabel} · ${scopeHint}`} />
      <ChipRow>
        {LEVELS.map((l) => (
          <Chip
            key={l.key}
            label={l.label}
            selected={level === l.key}
            onPress={() => setLevel(l.key)}
            accessibilityLabel={`Dashboard level ${l.label}`}
          />
        ))}
      </ChipRow>

      {loading ? (
        <LoadingState label="Loading dashboard…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : data?.empty || kpis.length === 0 ? (
        <EmptyState message={data?.emptyLabel ?? "No rounds in this workspace"} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text
            variant="micro"
            style={{ color: colors.steel, letterSpacing: 0.8, marginBottom: spacing.sm }}
          >
            PIPELINE SNAPSHOT
          </Text>
          <View style={styles.kpiGrid}>
            {kpis.map((k) => (
              <GlassCard key={k.key} style={styles.kpiCard}>
                <Text muted variant="micro" numberOfLines={2}>
                  {k.label}
                </Text>
                <Text
                  variant="title"
                  style={{ color: colors.brand, fontSize: 22, marginTop: 6 }}
                  numberOfLines={1}
                >
                  {formatKpiValue(k.value, k.format)}
                </Text>
              </GlassCard>
            ))}
          </View>

          <PreconBarChart
            title="Rounds by status"
            subtitle="Scoped lifecycle mix for this level"
            points={statusPoints}
            emptyLabel="No status counts"
            valueFormat="number"
          />

          <PreconDonutChart
            title="Status share"
            subtitle="Same scoped series · proportional"
            points={statusPoints}
            emptyLabel="No status mix"
          />

          <PreconBarChart
            title={data?.groupVolumeTitle ?? "Pursuit volume by group"}
            subtitle={data?.groupVolumeSubtitle ?? "Estimate value"}
            points={groupPoints}
            emptyLabel="No volume for this level"
            valueFormat="dollars"
          />

          {headlines.length > 0 ? (
            <>
              <Text
                variant="micro"
                style={{
                  color: colors.steel,
                  letterSpacing: 0.8,
                  marginTop: spacing.sm,
                  marginBottom: spacing.sm,
                }}
              >
                HEADLINE METRICS
              </Text>
              {headlines.map((m) => (
                <GlassCard key={m.key} style={{ marginBottom: spacing.sm }}>
                  <View style={styles.headlineRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="callout" style={{ color: colors.brand }} numberOfLines={2}>
                        {m.label}
                      </Text>
                      {m.group ? (
                        <Text muted variant="caption">
                          {m.group}
                        </Text>
                      ) : null}
                    </View>
                    <Text variant="headline" style={{ color: colors.brand }}>
                      {formatKpiValue(m.value, m.format)}
                    </Text>
                  </View>
                </GlassCard>
              ))}
            </>
          ) : null}

          {(data?.studio?.length ?? 0) > 0 ? (
            <>
              <Text
                variant="micro"
                style={{
                  color: colors.steel,
                  letterSpacing: 0.8,
                  marginTop: spacing.lg,
                  marginBottom: spacing.sm,
                }}
              >
                STUDIO BOARDS
              </Text>
              {data!.studio!.slice(0, 8).map((s) => (
                <ListRow
                  key={s.id}
                  title={s.name}
                  subtitle={s.scope ?? (s.published ? "Published" : "Personal")}
                  icon="chart"
                  onPress={() => router.push(`/(app)/more/studio/${s.id}` as never)}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kpiCard: { width: "48%", flexGrow: 1, minWidth: 148, marginBottom: 0 },
  headlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
});
