import { useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Text } from "@/src/components/ui/Text";
import { EmptyState, ErrorState } from "@/src/components/StateViews";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";

export default function SearchScreen() {
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ title: string; subtitle?: string }[]>([]);
  const [emptyMsg, setEmptyMsg] = useState<string | null>("Enter a search term");
  const [error, setError] = useState<string | null>(null);

  const run = async (query: string) => {
    setQ(query);
    setError(null);
    if (!query.trim()) {
      setResults([]);
      setEmptyMsg("Enter a search term");
      return;
    }
    try {
      const res = await apiFetch<{ data: { title: string; subtitle?: string }[]; empty?: boolean; message?: string }>(
        `/api/v1/mobile/search?q=${encodeURIComponent(query)}`,
      );
      setResults(res.data ?? []);
      setEmptyMsg(res.data?.length ? null : "No matches");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    }
  };

  return (
    <Screen>
      <GlassHeader title="Search" />
      <View style={{ padding: spacing.lg }}>
        <TextInput
          value={q}
          onChangeText={run}
          placeholder="Jobs, sheets…"
          style={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            backgroundColor: colors.card,
            color: colors.foreground,
            minHeight: 44,
          }}
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search"
        />
      </View>
      {error ? (
        <ErrorState message={error} />
      ) : emptyMsg ? (
        <EmptyState message={emptyMsg} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <GlassCard>
              <Text variant="callout">{item.title}</Text>
              {item.subtitle ? <Text muted>{item.subtitle}</Text> : null}
            </GlassCard>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({

});
