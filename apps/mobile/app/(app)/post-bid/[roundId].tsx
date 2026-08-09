import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiFetch, ApiError } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { Chip } from "@/src/components/ui/Chip";
import { StatusBadge } from "@/src/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "dollars" | "date" | "dropdown" | "multi";
  tier: "required" | "optional";
  group: string;
  listKey?: string;
  note?: string;
};

type RoundPayload = {
  round: Record<string, unknown>;
  job: { jobName: string; jobNumber: string; region?: string };
  estimateLeadName?: string | null;
  multiValues: Record<string, string[]>;
  customValues: Record<string, string>;
  fieldDefs: FieldDef[];
  referenceLists: Record<string, string[]>;
  missingRequired: string[];
};

const READ_ONLY_KEYS = new Set(["jobNumber", "jobName", "estimateLead"]);

export default function RoundEntryScreen() {
  const { colors } = useTheme();
  const { roundId } = useLocalSearchParams<{ roundId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [payload, setPayload] = useState<RoundPayload | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState<Record<string, string[]>>({});
  const [showOptional, setShowOptional] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: RoundPayload }>(
        `/api/v1/mobile/rounds/${roundId}`,
      );
      const d = res.data;
      setPayload(d);
      const next: Record<string, string> = {};
      for (const f of d.fieldDefs) {
        if (READ_ONLY_KEYS.has(f.key) || f.type === "multi") continue;
        const raw = d.round[f.key];
        next[f.key] = raw == null ? "" : String(raw);
      }
      setValues(next);
      setMulti(d.multiValues ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    if (!payload) return [] as { name: string; fields: FieldDef[] }[];
    const map = new Map<string, FieldDef[]>();
    for (const f of payload.fieldDefs) {
      if (READ_ONLY_KEYS.has(f.key)) continue;
      if (f.tier === "optional" && !showOptional) continue;
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return Array.from(map.entries()).map(([name, fields]) => ({ name, fields }));
  }, [payload, showOptional]);

  if (loading) return <LoadingState label="Loading round…" />;
  if (error) return <ErrorState message={error} />;
  if (!payload) return <EmptyState message="Round not found" />;

  const { job, missingRequired, referenceLists, round } = payload;
  const status = String(round.status);
  const canLock = user?.role === "rpd" || user?.role === "corporate_admin";

  const setField = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const toggleMulti = (key: string, option: string) => {
    setMulti((prev) => {
      const cur = prev[key] ?? [];
      const has = cur.includes(option);
      return {
        ...prev,
        [key]: has ? cur.filter((x) => x !== option) : [...cur, option],
      };
    });
  };

  const save = async () => {
    setSaving(true);
    setBanner(null);
    try {
      await apiFetch(`/api/v1/mobile/rounds/${roundId}`, {
        method: "PUT",
        body: JSON.stringify({
          values,
          multiValues: multi,
          customValues: {},
        }),
      });
      setBanner("Saved successfully");
      await load();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <GlassHeader title={job.jobName} subtitle={`Round · ${job.jobNumber}`} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statusRow}>
          <StatusBadge status={status} />
          <Text muted variant="caption">
            Lead: {payload.estimateLeadName ?? "—"}
          </Text>
        </View>

        {banner ? (
          <GlassCard style={{ marginTop: spacing.md, backgroundColor: colors.successSoft }}>
            <Text style={{ color: colors.successForeground }}>{banner}</Text>
          </GlassCard>
        ) : null}

        {missingRequired.length > 0 ? (
          <GlassCard style={{ marginTop: spacing.md }}>
            <Text variant="callout" style={{ color: colors.warning }}>
              Missing required ({missingRequired.length})
            </Text>
            {missingRequired.slice(0, 12).map((m) => (
              <Text key={m} muted variant="caption">
                • {m}
              </Text>
            ))}
            {missingRequired.length > 12 ? (
              <Text muted variant="caption">
                …and {missingRequired.length - 12} more
              </Text>
            ) : null}
          </GlassCard>
        ) : (
          <GlassCard style={{ marginTop: spacing.md, backgroundColor: colors.successSoft }}>
            <Text style={{ color: colors.successForeground }}>All required fields complete</Text>
          </GlassCard>
        )}

        <Pressable
          onPress={() => setShowOptional((v) => !v)}
          style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
        >
          <Text variant="callout" style={{ color: colors.foreground }}>
            {showOptional ? "Hide optional fields" : "Show optional fields"}
          </Text>
        </Pressable>

        {groups.map((g) => (
          <View key={g.name} style={{ marginBottom: spacing.lg }}>
            <Text
              variant="micro"
              style={{
                color: colors.steel,
                letterSpacing: 0.8,
                marginBottom: spacing.sm,
              }}
            >
              {g.name.toUpperCase()}
            </Text>
            <GlassCard>
              {g.fields.map((f, idx) => (
                <View
                  key={f.key}
                  style={[
                    styles.fieldBlock,
                    idx > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                      paddingTop: spacing.md,
                      marginTop: spacing.md,
                    },
                  ]}
                >
                  <Text variant="callout" style={{ marginBottom: 4 }}>
                    {f.label}
                    {f.tier === "required" ? (
                      <Text style={{ color: colors.destructive }}> *</Text>
                    ) : null}
                  </Text>
                  {f.note ? (
                    <Text muted variant="caption" style={{ marginBottom: 6 }}>
                      {f.note}
                    </Text>
                  ) : null}
                  {f.type === "multi" ? (
                    <View style={styles.chipWrap}>
                      {(referenceLists[f.listKey ?? ""] ?? []).map((opt) => {
                        const on = (multi[f.key] ?? []).includes(opt);
                        return (
                          <Chip
                            key={opt}
                            label={opt}
                            selected={on}
                            onPress={() => toggleMulti(f.key, opt)}
                          />
                        );
                      })}
                      {(referenceLists[f.listKey ?? ""] ?? []).length === 0 ? (
                        <Text muted variant="caption">
                          No options loaded
                        </Text>
                      ) : null}
                    </View>
                  ) : f.type === "dropdown" ? (
                    <View style={styles.chipWrap}>
                      {(referenceLists[f.listKey ?? ""] ?? []).map((opt) => (
                        <Chip
                          key={opt}
                          label={opt}
                          selected={values[f.key] === opt}
                          onPress={() => setField(f.key, opt)}
                        />
                      ))}
                      {(referenceLists[f.listKey ?? ""] ?? []).length === 0 ? (
                        <TextInput
                          value={values[f.key] ?? ""}
                          onChangeText={(t) => setField(f.key, t)}
                          placeholder="Enter value"
                          placeholderTextColor={colors.muted}
                          style={[
                            styles.input,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.input,
                              color: colors.foreground,
                            },
                          ]}
                        />
                      ) : null}
                    </View>
                  ) : (
                    <TextInput
                      value={values[f.key] ?? ""}
                      onChangeText={(t) => setField(f.key, t)}
                      keyboardType={
                        f.type === "number" || f.type === "dollars"
                          ? "decimal-pad"
                          : f.type === "date"
                            ? "default"
                            : "default"
                      }
                      placeholder={
                        f.type === "date"
                          ? "YYYY-MM-DD"
                          : f.type === "dollars"
                            ? "0"
                            : ""
                      }
                      placeholderTextColor={colors.muted}
                      style={[
                        styles.input,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.input,
                          color: colors.foreground,
                        },
                      ]}
                    />
                  )}
                </View>
              ))}
            </GlassCard>
          </View>
        ))}

        <Button title={saving ? "Saving…" : "Save all fields"} onPress={save} disabled={saving} />

        {canLock ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Button
              title="Approve & Lock"
              onPress={async () => {
                try {
                  await apiFetch(`/api/v1/mobile/rounds/${roundId}/approve-lock`, {
                    method: "POST",
                  });
                  setBanner("Locked");
                  await load();
                } catch (e) {
                  if (e instanceof ApiError) {
                    const body = e.body as {
                      missingFields?: string[];
                      details?: string[];
                    };
                    const list = body?.missingFields ?? body?.details ?? [];
                    Alert.alert(
                      "Cannot lock",
                      list.length ? list.join("\n") : e.message,
                    );
                  } else {
                    Alert.alert("Error", e instanceof Error ? e.message : "Lock failed");
                  }
                }
              }}
            />
            <Button
              title="Mark successful"
              variant="secondary"
              onPress={async () => {
                await apiFetch(`/api/v1/mobile/rounds/${roundId}/outcome`, {
                  method: "POST",
                  body: JSON.stringify({ outcome: "successful" }),
                });
                setBanner("Outcome updated");
                await load();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  fieldBlock: {},
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: 12,
    minHeight: 44,
    fontSize: 15,
    fontFamily: "Manrope_400Regular",
  },
});
