import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { useTheme } from "@/src/theme/ThemeContext";
import { radii, spacing } from "@/src/theme/tokens";

export default function MagnusScreen() {
  const { colors } = useTheme();
  const [prompt, setPrompt] = useState("Summarize Central region pipeline");
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <GlassHeader title="Magnus AI" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <GlassCard>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            multiline
            accessibilityLabel="Ask Magnus"
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 80,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
              backgroundColor: colors.input,
              color: colors.foreground,
              fontFamily: "Manrope_400Regular",
              fontSize: 15,
            }}
          />
          <Button
            title="Ask"
            onPress={async () => {
              setError(null);
              try {
                const res = await apiFetch<{ response: unknown }>("/api/v1/mobile/copilot", {
                  method: "POST",
                  body: JSON.stringify({ action: "ask", prompt }),
                });
                const r = res.response;
                setResponse(
                  typeof r === "string"
                    ? r
                    : r && typeof r === "object" && "message" in (r as object)
                      ? String((r as { message: string }).message)
                      : JSON.stringify(r),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            }}
          />
          {error ? (
            <Text style={{ color: colors.destructive, marginTop: 8 }}>{error}</Text>
          ) : null}
          {response ? (
            <Text style={{ marginTop: spacing.md, color: colors.foreground }}>{response}</Text>
          ) : null}
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}
