import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Text } from "@/src/components/ui/Text";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { spacing } from "@/src/theme/tokens";

type Widget = {
  id: number;
  sortOrder: number;
  config: { title?: string; kind?: string; metricKey?: string | null };
};

type Dashboard = {
  id: number;
  name: string;
  description: string | null;
  scope: string;
  region: string | null;
  published: boolean;
};

export default function StudioDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{
          data: { dashboard: Dashboard; widgets: Widget[] };
        }>(`/api/v1/mobile/dashboards/${id}`);
        setDashboard(res.data.dashboard);
        setWidgets(res.data.widgets ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <Screen>
      <GlassHeader
        title={dashboard?.name ?? "Dashboard"}
        subtitle={dashboard ? `${dashboard.scope}${dashboard.region ? ` · ${dashboard.region}` : ""}` : undefined}
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : !dashboard ? (
        <EmptyState message="Dashboard not found" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {dashboard.description ? (
            <Text muted style={{ marginBottom: spacing.md }}>
              {dashboard.description}
            </Text>
          ) : null}
          <View style={styles.meta}>
            {dashboard.published ? <Badge label="Published" tone="success" /> : <Badge label="Draft" />}
            <Badge label={dashboard.scope} tone="info" />
          </View>
          <Text variant="callout" style={{ marginBottom: spacing.sm }}>
            Widgets ({widgets.length})
          </Text>
          {widgets.length === 0 ? (
            <EmptyState message="No widgets on this board yet" />
          ) : (
            widgets.map((w) => (
              <GlassCard key={w.id}>
                <Text variant="callout">{w.config?.title ?? `Widget ${w.id}`}</Text>
                <Text muted>
                  {w.config?.kind ?? "widget"}
                  {w.config?.metricKey ? ` · ${w.config.metricKey}` : ""}
                </Text>
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
  meta: { flexDirection: "row", gap: 8, marginBottom: spacing.lg },
});
