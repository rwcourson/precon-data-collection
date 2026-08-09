import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { GlassView } from "@/src/components/ui/GlassView";
import { Text } from "@/src/components/ui/Text";
import { ListRow } from "@/src/components/ui/ListRow";
import { LoadingState, ErrorState } from "@/src/components/StateViews";
import { PreconBarChart } from "@/src/components/charts/PreconCharts";
import { useTheme } from "@/src/theme/ThemeContext";
import { spacing } from "@/src/theme/tokens";
import { normalizeByStatusMap } from "@/src/lib/mobile-chart-adapters";
import type { PreconIconName } from "@/src/components/ui/Icon";

type OverviewPayload = {
  workspace: { region: string | null; label: string };
  bidYear: number;
  kpis: {
    ytdVolume: number;
    ytdVolumeLabel: string;
    ytdRoundCount: number;
    awaitingPostBid: number;
    awaitingApproval: number;
    winRatePct: number | null;
    wins: number;
    decided: number;
  };
  byStatus: Record<string, number>;
  totalRounds: number;
};

const MODULES: {
  href: string;
  title: string;
  sub: string;
  icon: PreconIconName;
}[] = [
  { href: "/(app)/schedule", title: "Bid Schedule", sub: "Active · Upcoming · Outstanding", icon: "calendar" },
  { href: "/(app)/post-bid", title: "Post-Bid Entry", sub: "Complete · approve · lock", icon: "pen" },
  { href: "/(app)/sheets", title: "Sheets", sub: "Workspace grids & views", icon: "grid" },
  { href: "/(app)/more/dashboards", title: "Dashboards", sub: "Corporate · region · division", icon: "chart" },
  { href: "/(app)/more/reports", title: "Reports", sub: "Builder · annual · export", icon: "fileText" },
  { href: "/(app)/more/admin", title: "Admin", sub: "Governance · Destini · trash", icon: "shield" },
  { href: "/(app)/more/magnus", title: "Magnus AI", sub: "Ask Precon data", icon: "sparkles" },
];

export default function OverviewScreen() {
  const { user, workspaceLabel } = useAuth();
  const { colors, isDark } = useTheme();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<OverviewPayload>("/api/v1/mobile/overview");
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const k = data?.kpis;
  const scope = data?.workspace.label ?? workspaceLabel;
  const statusChart = useMemo(
    () => normalizeByStatusMap(data?.byStatus, { dark: isDark }),
    [data?.byStatus, isDark],
  );

  return (
    <Screen>
      <GlassHeader
        title="Overview"
        subtitle={`${user?.name ?? ""} · ${scope}`}
        onSearch={() => router.push("/(app)/more/search")}
        onNotifications={() => router.push("/(app)/more/notifications")}
      />
      {loading && !data ? (
        <LoadingState label="Loading portfolio…" />
      ) : error && !data ? (
        <ErrorState message={error} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.muted}
            />
          }
        >
          <GlassView intensity={36} style={styles.hero}>
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(255,255,255,0.06)", "transparent"]
                  : ["rgba(24,24,27,0.04)", "transparent"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text variant="micro" style={{ color: colors.muted, letterSpacing: 1.1 }}>
              BRASFIELD & GORRIE · PRECON
            </Text>
            <Text variant="headline" style={{ color: colors.foreground, marginTop: 4 }}>
              {data?.bidYear ?? 2026} portfolio
            </Text>
            <Text muted style={{ marginTop: 4 }}>
              {data?.totalRounds ?? 0} rounds in scope · pull to refresh
            </Text>
          </GlassView>

          <View style={styles.kpiGrid}>
            <KpiCard
              label={`${data?.bidYear ?? 2026} Pursuit Volume`}
              value={k?.ytdVolumeLabel ?? "—"}
              sub={`${k?.ytdRoundCount ?? 0} estimate rounds`}
            />
            <KpiCard
              label="Awaiting Post-Bid"
              value={String(k?.awaitingPostBid ?? "—")}
              sub="Submitted or in data entry"
            />
            <KpiCard
              label="Awaiting RPD Approval"
              value={String(k?.awaitingApproval ?? "—")}
              sub="In post-bid data entry"
            />
            <KpiCard
              label="Win Rate (decided)"
              value={k?.winRatePct != null ? `${k.winRatePct}%` : "—"}
              sub={`${k?.wins ?? 0} of ${k?.decided ?? 0} decided`}
            />
          </View>

          {statusChart.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <PreconBarChart
                title="Rounds by status"
                subtitle="Same portfolio as web overview"
                points={statusChart}
              />
            </View>
          ) : null}

          <Text
            variant="callout"
            style={{ color: colors.muted, marginBottom: spacing.sm, marginTop: spacing.lg }}
          >
            Modules
          </Text>
          {MODULES.map((m) => (
            <ListRow
              key={m.href}
              title={m.title}
              subtitle={m.sub}
              icon={m.icon}
              onPress={() => router.push(m.href as never)}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  const { colors } = useTheme();
  return (
    <GlassCard style={styles.kpiCard}>
      <Text variant="micro" style={{ color: colors.muted, marginBottom: 6 }} numberOfLines={2}>
        {label}
      </Text>
      <Text variant="title" style={{ color: colors.foreground, fontSize: 24 }} numberOfLines={1}>
        {value}
      </Text>
      <Text muted variant="caption" style={{ marginTop: 4 }} numberOfLines={2}>
        {sub}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },
  hero: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  kpiCard: {
    width: "47%",
    flexGrow: 1,
    minWidth: 148,
    marginBottom: 0,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
