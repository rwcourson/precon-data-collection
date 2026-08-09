import { useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiFetch, ApiError } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";

type Row = Record<string, unknown>;

function titleCase(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminSection() {
  const { colors } = useTheme();
  const { section } = useLocalSearchParams<{ section: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState("Job Number,Estimate Value\nTBD-1,1000000");
  const [msg, setMsg] = useState<string | null>(null);
  const [previewKeys, setPreviewKeys] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ data?: Row[] }>(
          `/api/v1/mobile/admin?section=${section}`,
        );
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [section]);

  const label = titleCase(String(section ?? "Admin"));

  return (
    <Screen>
      <GlassHeader title={label} subtitle="Admin" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {section === "lists" ? (
            <GlassCard>
              <Text muted style={{ marginBottom: spacing.sm }}>
                Add a market sector reference value (corporate admin)
              </Text>
              <Button
                title="Add sample value"
                onPress={async () => {
                  try {
                    await apiFetch("/api/v1/mobile/admin", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "add-reference",
                        listKey: "marketSector",
                        value: `Mobile ${Date.now()}`,
                      }),
                    });
                    setMsg("Value added");
                    const res = await apiFetch<{ data?: Row[] }>(
                      `/api/v1/mobile/admin?section=lists`,
                    );
                    setRows(Array.isArray(res.data) ? res.data : []);
                  } catch (e) {
                    if (e instanceof ApiError) setMsg(`${e.status}: ${e.message}`);
                    else setMsg("Failed");
                  }
                }}
              />
            </GlassCard>
          ) : null}

          {section === "destini" ? (
            <GlassCard>
              <Text muted>Paste Destini CSV for preview</Text>
              <TextInput
                multiline
                value={csv}
                onChangeText={setCsv}
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
                accessibilityLabel="Destini CSV"
              />
              <Button
                title="Preview Destini"
                onPress={async () => {
                  try {
                    const res = await apiFetch<{ preview: Record<string, unknown> }>(
                      "/api/v1/mobile/admin",
                      {
                        method: "POST",
                        body: JSON.stringify({ action: "destini-preview", text: csv }),
                      },
                    );
                    const keys = res.preview ? Object.keys(res.preview) : [];
                    setPreviewKeys(keys);
                    setMsg(`Preview ready · ${keys.length} keys`);
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Preview failed");
                  }
                }}
              />
              {previewKeys.length > 0 ? (
                <View style={{ marginTop: spacing.md, gap: 6 }}>
                  {previewKeys.slice(0, 12).map((k) => (
                    <Badge key={k} label={k} tone="info" />
                  ))}
                </View>
              ) : null}
            </GlassCard>
          ) : null}

          {msg ? (
            <Text style={{ marginVertical: spacing.sm }} muted>
              {msg}
            </Text>
          ) : null}

          <Text variant="callout" style={{ marginBottom: spacing.sm }}>
            Records ({rows.length})
          </Text>
          {rows.length === 0 && section !== "destini" ? (
            <EmptyState message="No records in this section" />
          ) : (
            <FlatList
              data={rows.slice(0, 50)}
              scrollEnabled={false}
              keyExtractor={(item, i) => String(item.id ?? i)}
              renderItem={({ item }) => {
                const title =
                  String(item.name ?? item.value ?? item.action ?? item.jobNumber ?? item.id ?? "Item");
                const sub = [
                  item.listKey,
                  item.entity,
                  item.status,
                  item.region,
                ]
                  .filter(Boolean)
                  .map(String)
                  .join(" · ");
                return (
                  <GlassCard>
                    <Text variant="callout" numberOfLines={2}>
                      {title}
                    </Text>
                    {sub ? <Text muted>{sub}</Text> : null}
                  </GlassCard>
                );
              }}
            />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },

});
