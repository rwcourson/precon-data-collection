import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Text } from "@/src/components/ui/Text";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import {
  formatDollars,
  formatRoundsBadge,
  formatRoundsVolumeLine,
  volumeFromStats,
  type RollupStatsLike,
} from "@/src/lib/annual-display";
import { useTheme } from "@/src/theme/ThemeContext";
import { spacing } from "@/src/theme/tokens";

type YearStat = {
  year: number;
  stats: RollupStatsLike;
};

type Win = {
  jobNumber: string;
  jobName: string;
  marketSector: string | null;
  estimateValue: number | null;
  estimatePhase: string;
};

type AnnualData = {
  scope: string;
  fromYear: number;
  toYear: number;
  years: YearStat[];
  focusYear?: number;
  wins?: Win[];
  emptyReason?: string | null;
  overall?: RollupStatsLike;
};

export default function AnnualReportScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState<AnnualData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ data: AnnualData; empty?: boolean; emptyLabel?: string }>(
          "/api/v1/mobile/reports/annual",
        );
        setData(res.data);
        if (res.empty && !res.data) {
          setError(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load annual report");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Screen>
      <GlassHeader
        title="Annual Report"
        subtitle={data ? `${data.fromYear}–${data.toYear}` : undefined}
      />
      {loading ? (
        <LoadingState label="Loading annual report…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data || data.emptyReason ? (
        <EmptyState message={data?.emptyReason ?? "No annual report data"} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <GlassCard>
            <Text muted variant="micro">
              SCOPE
            </Text>
            <Text variant="headline" style={{ color: colors.brand }}>
              {data.scope}
            </Text>
            {data.overall ? (
              <Text muted style={{ marginTop: spacing.sm }}>
                {formatRoundsVolumeLine(data.overall)}
              </Text>
            ) : null}
          </GlassCard>

          <Text
            variant="callout"
            style={{
              marginTop: spacing.md,
              marginBottom: spacing.sm,
              color: colors.brand,
            }}
          >
            Year trends
          </Text>
          {(data.years ?? []).map((y) => (
            <GlassCard key={y.year}>
              <View style={styles.row}>
                <Text variant="headline" style={{ color: colors.brand }}>
                  {y.year}
                </Text>
                <Badge label={formatRoundsBadge(y.stats)} tone="info" />
              </View>
              <Text muted>{formatDollars(volumeFromStats(y.stats))}</Text>
            </GlassCard>
          ))}

          <Text
            variant="callout"
            style={{
              marginTop: spacing.md,
              marginBottom: spacing.sm,
              color: colors.brand,
            }}
          >
            Top wins {data.focusYear ? `· ${data.focusYear}` : ""}
          </Text>
          {(data.wins ?? []).length === 0 ? (
            <EmptyState message="No wins recorded for the focus year" />
          ) : (
            (data.wins ?? []).map((w) => (
              <GlassCard key={`${w.jobNumber}-${w.jobName}`}>
                <Text variant="callout" numberOfLines={2} style={{ color: colors.brand }}>
                  {w.jobName}
                </Text>
                <Text muted>
                  {w.jobNumber}
                  {w.marketSector ? ` · ${w.marketSector}` : ""} · {w.estimatePhase}
                </Text>
                <Text style={{ marginTop: 4 }}>{formatDollars(w.estimateValue)}</Text>
              </GlassCard>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
});
