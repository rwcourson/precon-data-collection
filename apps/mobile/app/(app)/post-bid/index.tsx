import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Text } from "@/src/components/ui/Text";
import { Chip, ChipRow } from "@/src/components/ui/Chip";
import { StatusBadge } from "@/src/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatDueDateHuman } from "@/src/lib/mobile-data-display";

type Row = {
  roundId: number;
  jobName: string;
  jobNumber: string;
  status: string;
  estimatePhase?: string;
  bidDueDate?: string | null;
  estimateValue?: number | null;
  preconDepartment?: string;
};

const FILTERS: { key: "queue" | "locked" | "all"; label: string }[] = [
  { key: "queue", label: "Needs entry" },
  { key: "locked", label: "Locked" },
  { key: "all", label: "All" },
];

export default function PostBidList() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("queue");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Row[] }>("/api/v1/mobile/bid-schedule?section=all");
      // Same pool web post-bid cares about: submitted → locked lifecycle
      setRows(
        (res.data ?? []).filter((r) =>
          ["submitted", "post_bid", "locked", "outstanding"].includes(r.status),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "queue") {
      return rows.filter((r) => ["submitted", "post_bid", "outstanding"].includes(r.status));
    }
    if (filter === "locked") return rows.filter((r) => r.status === "locked");
    return rows;
  }, [rows, filter]);

  return (
    <Screen>
      <GlassHeader
        title="Post-Bid"
        subtitle={`${visible.length} rounds · entry & approval`}
      />
      <ChipRow>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ChipRow>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : visible.length === 0 ? (
        <EmptyState message="No rounds in this filter" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => String(r.roundId)}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/post-bid/${item.roundId}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
            >
              <GlassCard>
                <View style={styles.rowTop}>
                  <Text
                    variant="callout"
                    style={{ flex: 1, color: colors.foreground }}
                    numberOfLines={2}
                  >
                    {item.jobName}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text muted>
                  {item.jobNumber}
                  {item.estimatePhase ? ` · ${item.estimatePhase}` : ""}
                </Text>
                <Text muted variant="caption" style={{ marginTop: 2 }}>
                  Due {formatDueDateHuman(item.bidDueDate ?? null)}
                  {item.preconDepartment ? ` · ${item.preconDepartment}` : ""}
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
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
});
