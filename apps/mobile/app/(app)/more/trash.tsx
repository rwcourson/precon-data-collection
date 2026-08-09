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

type Item = { entityType: string; entityId: number; label?: string };

export default function TrashScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Item[] }>("/api/v1/mobile/trash");
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
      <GlassHeader title="Trash" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState message="Trash is empty" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => `${i.entityType}-${i.entityId}`}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <GlassCard>
              <Text>
                {item.entityType} #{item.entityId}
              </Text>
              <Button
                title="Restore"
                variant="secondary"
                onPress={async () => {
                  await apiFetch("/api/v1/mobile/trash", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "restore",
                      entityType: item.entityType,
                      entityId: item.entityId,
                    }),
                  });
                  await load();
                }}
              />
            </GlassCard>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
});
