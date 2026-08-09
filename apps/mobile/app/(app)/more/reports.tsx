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
import * as WebBrowser from "expo-web-browser";
import { getApiBaseUrl, getStoredToken } from "@/src/api/client";

export default function ReportsScreen() {
  const [list, setList] = useState<{ id: number; name: string }[]>([]);
  const [presets, setPresets] = useState<{ name: string; config: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{
          data: { id: number; name: string }[];
          presets: { name: string; config: unknown }[];
        }>("/api/v1/mobile/reports");
        setList(res.data ?? []);
        setPresets(res.presets ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Screen>
      <GlassHeader title="Reports" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md, gap: spacing.sm }}>
              {presets[0] ? (
                <Button
                  title={`Run: ${presets[0].name}`}
                  onPress={async () => {
                    const res = await apiFetch<{ result: { rowCount: number } }>(
                      "/api/v1/mobile/reports",
                      {
                        method: "POST",
                        body: JSON.stringify({ action: "run", config: presets[0].config }),
                      },
                    );
                    setRunInfo(`Rows: ${res.result.rowCount}`);
                    await apiFetch("/api/v1/mobile/reports", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "save",
                        name: `Mobile ${presets[0].name}`,
                        config: presets[0].config,
                      }),
                    });
                  }}
                />
              ) : null}
              <Button
                title="Export bid schedule (browser)"
                variant="secondary"
                onPress={async () => {
                  try {
                    const token = await getStoredToken();
                    const url = `${getApiBaseUrl()}/api/export/bid-schedule`;
                    await WebBrowser.openBrowserAsync(url);
                    setRunInfo(token ? "Opened export URL" : "Opened export (may need web session)");
                  } catch (e) {
                    setRunInfo(e instanceof Error ? e.message : "Export error");
                  }
                }}
              />
              {runInfo ? <Text muted>{runInfo}</Text> : null}
              {!list.length ? <EmptyState message="No saved reports yet" /> : null}
            </View>
          }
          renderItem={({ item }) => (
            <GlassCard>
              <Text variant="callout">{item.name}</Text>
            </GlassCard>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
});
