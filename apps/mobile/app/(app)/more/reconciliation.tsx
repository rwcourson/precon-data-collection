import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";

export default function ReconciliationScreen() {
  const { colors } = useTheme();
  const [text, setText] = useState("JOB-001,1000000");
  const [status, setStatus] = useState<string | null>(null);

  return (
    <Screen>
      <GlassHeader title="DMR Reconciliation" />
      <View style={{ padding: spacing.lg }}>
        <GlassCard>
          <Text muted style={{ marginBottom: spacing.sm }}>
            Paste CSV lines: jobNumber,dmrValue
          </Text>
          <TextInput
            multiline
            value={text}
            onChangeText={setText}
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
            accessibilityLabel="DMR file content"
          />
          <Button
            title="Upload"
            onPress={async () => {
              try {
                const res = await apiFetch<{ status: string; importId?: number }>(
                  "/api/v1/mobile/reconciliation",
                  {
                    method: "POST",
                    body: JSON.stringify({ text, filename: "dmr.csv" }),
                  },
                );
                setStatus(`success: import ${res.importId ?? ""}`.trim());
              } catch (e) {
                setStatus(e instanceof Error ? e.message : "error");
              }
            }}
          />
          {status ? <Text style={{ marginTop: spacing.md }}>Upload result: {status}</Text> : null}
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({

});
