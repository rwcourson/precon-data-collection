import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { spacing } from "@/src/theme/tokens";

export default function NotificationsScreen() {
  const [items, setItems] = useState<{ id: number; title?: string; body?: string; message?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: typeof items }>("/api/v1/mobile/notifications");
      setItems(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen>
      <GlassHeader title="Notifications" />
      <View style={{ padding: spacing.lg }}>
        <Button
          title="Mark all read"
          variant="secondary"
          onPress={async () => {
            await apiFetch("/api/v1/mobile/notifications", { method: "POST" });
            await load();
          }}
        />
      </View>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState message="No notifications" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <GlassCard>
              <Text>{item.title ?? item.message ?? item.body ?? "Notification"}</Text>
            </GlassCard>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
});
