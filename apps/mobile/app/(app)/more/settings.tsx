import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme, type ThemePreference } from "@/src/theme/ThemeContext";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { Screen } from "@/src/components/ui/Screen";
import { Icon, type PreconIconName } from "@/src/components/ui/Icon";
import { spacing, radii, ICON_DEFAULTS } from "@/src/theme/tokens";

const MODES: { key: ThemePreference; label: string; icon: PreconIconName }[] = [
  { key: "system", label: "System", icon: "smartphone" },
  { key: "light", label: "Light", icon: "sun" },
  { key: "dark", label: "Dark", icon: "moon" },
];

export default function SettingsScreen() {
  const { user, availableRegions, setWorkspace, signOut, personas, signInDemo, workspaceLabel } =
    useAuth();
  const { colors, preference, setPreference, resolved } = useTheme();

  return (
    <Screen>
      <GlassHeader title="Settings" subtitle={user?.name} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text variant="callout" style={{ marginBottom: spacing.sm, color: colors.muted }}>
          Appearance
        </Text>
        <GlassCard>
          <Text muted style={{ marginBottom: spacing.md }}>
            Resolved: {resolved} · Manrope · thin Lucide · grey layout
          </Text>
          <View style={styles.row}>
            {MODES.map((m) => {
              const on = preference === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setPreference(m.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Theme ${m.label}`}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor: on ? colors.chipOn : colors.chip,
                    },
                  ]}
                >
                  <Icon
                    name={m.icon}
                    size={16}
                    color={on ? colors.chipOnText : colors.chipText}
                    strokeWidth={ICON_DEFAULTS.strokeWidth}
                    active={on}
                  />
                  <Text
                    style={{
                      color: on ? colors.chipOnText : colors.chipText,
                      fontSize: 12,
                      fontFamily: "Manrope_600SemiBold",
                    }}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard>
          <Text variant="callout">Workspace: {workspaceLabel}</Text>
          {availableRegions.map((r) => (
            <Button key={r} title={r} variant="ghost" onPress={() => setWorkspace(r)} />
          ))}
          <Button title="Corporate" variant="ghost" onPress={() => setWorkspace("corporate")} />
        </GlassCard>

        <GlassCard>
          <Text variant="callout">Switch persona</Text>
          {personas.map((p) => (
            <Button
              key={p.id}
              title={`${p.name} (${p.role})`}
              variant="secondary"
              onPress={() => signInDemo(p.id)}
            />
          ))}
        </GlassCard>

        <Button
          title="Sign out"
          variant="destructive"
          onPress={async () => {
            await signOut();
            router.replace("/(auth)/sign-in");
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
});
