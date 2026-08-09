import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Text } from "@/src/components/ui/Text";
import { StatusBadge } from "@/src/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { spacing } from "@/src/theme/tokens";

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [data, setData] = useState<{
    job: { jobName: string; jobNumber: string; region: string };
    rounds: { id: number; status: string; roundNumber: number; estimatePhase: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ data: typeof data }>(`/api/v1/mobile/jobs/${jobId}`);
        setData(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  return (
    <Screen>
      <GlassHeader title={data?.job.jobName ?? "Job"} subtitle={data?.job.jobNumber} />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <EmptyState message="Job not found" />
      ) : (
        <FlatList
          data={data.rounds}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: spacing.lg }}
          ListHeaderComponent={
            <Text muted style={{ marginBottom: spacing.md }}>
              {data.job.region} · {data.rounds.length} rounds
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/(app)/post-bid/${item.id}`)}>
              <GlassCard>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="callout">
                    Round {item.roundNumber} · {item.estimatePhase}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
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
