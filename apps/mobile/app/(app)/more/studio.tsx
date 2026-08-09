import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { spacing } from "@/src/theme/tokens";

type StudioItem = {
  id: number;
  name: string;
  scope: string;
  region: string | null;
  published: boolean;
};

export default function StudioScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<StudioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const canCreate =
    user &&
    ["corporate_admin", "rpd", "pcm", "estimate_lead", "admin_jsa"].includes(
      user.role,
    );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ studio: StudioItem[] }>(
        "/api/v1/mobile/dashboards?level=corporate",
      );
      setItems(res.studio ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <GlassHeader title="Dashboard Studio" subtitle={`${items.length} boards`} />
      {canCreate ? (
        <View style={{ padding: spacing.lg }}>
          <Button
            title="Create personal dashboard"
            onPress={async () => {
              setMsg(null);
              try {
                const res = await apiFetch<{ id: number }>(
                  "/api/v1/mobile/dashboards",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      name: `Mobile board ${new Date().toISOString().slice(0, 10)}`,
                      scope: "personal",
                      widgets: [
                        {
                          title: "Pipeline",
                          kind: "kpi",
                          metricKey: "estimateValue",
                        },
                      ],
                    }),
                  },
                );
                setMsg(`Created #${res.id}`);
                router.push(`/(app)/more/studio/${res.id}`);
              } catch (e) {
                if (e instanceof Error && /403|permission/i.test(e.message)) {
                  setMsg(e.message);
                } else {
                  setError(e instanceof Error ? e.message : "Create failed");
                }
              }
            }}
          />
          {msg ? <Text muted style={{ marginTop: 8 }}>{msg}</Text> : null}
        </View>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState message="No studio dashboards yet" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/more/studio/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open dashboard ${item.name}`}
            >
              <GlassCard>
                <Text variant="headline">{item.name}</Text>
                <Text muted>
                  {item.scope}
                  {item.region ? ` · ${item.region}` : ""}
                  {item.published ? " · published" : ""}
                </Text>
              </GlassCard>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
});
