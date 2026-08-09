import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Text } from "@/src/components/ui/Text";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { spacing } from "@/src/theme/tokens";

export default function AdminIndex() {
  const [sections, setSections] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ sections: { key: string; label: string }[] }>(
          "/api/v1/mobile/admin?section=index",
        );
        setSections(res.sections ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Screen>
      <GlassHeader title="Admin" subtitle="Governance" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : sections.length === 0 ? (
        <EmptyState message="No admin sections" />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.key}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (item.key === "trash") router.push("/(app)/more/trash");
                else router.push(`/(app)/more/admin/${item.key}`);
              }}
            >
              <GlassCard>
                <Text variant="headline">{item.label}</Text>
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
