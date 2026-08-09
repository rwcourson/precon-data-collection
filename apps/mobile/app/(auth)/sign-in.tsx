import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { GlassView } from "@/src/components/ui/GlassView";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { Badge } from "@/src/components/ui/Badge";
import { Screen } from "@/src/components/ui/Screen";
import { Icon } from "@/src/components/ui/Icon";
import { ICON_DEFAULTS, radii, spacing } from "@/src/theme/tokens";
import { LoadingState, ErrorState, EmptyState } from "@/src/components/StateViews";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, cyclePreference } = useTheme();
  const { user, personas, signInDemo, signInToken, loading, error } = useAuth();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !loading) router.replace("/(app)");
  }, [user, loading]);

  if (loading && !personas.length) {
    return <LoadingState label="Loading personas…" />;
  }

  return (
    <Screen style={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.xl }}>
      <View style={{ alignItems: "flex-end", marginBottom: spacing.sm }}>
        <Pressable
          onPress={cyclePreference}
          accessibilityLabel="Toggle theme"
          style={[styles.themeBtn, { backgroundColor: colors.iconBtn }]}
        >
          <Icon
            name={isDark ? "sun" : "moon"}
            size={ICON_DEFAULTS.size}
            color={colors.icon}
          />
        </Pressable>
      </View>

      <GlassView intensity={40} style={styles.hero}>
        <LinearGradient
          colors={
            isDark
              ? ["rgba(255,255,255,0.06)", "transparent"]
              : ["rgba(24,24,27,0.04)", "transparent"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text variant="micro" style={{ color: colors.steel, letterSpacing: 1.2, marginBottom: spacing.xs }}>
          BRASFIELD & GORRIE
        </Text>
        <Text variant="title" style={{ color: colors.foreground }}>
          Precon
        </Text>
        <Text muted style={{ marginTop: spacing.sm }}>
          Bid schedule · post-bid · dashboards — liquid glass mobile
        </Text>
      </GlassView>

      {(localError || error) ? (
        <View style={{ marginTop: spacing.md }}>
          <ErrorState message={localError || error || ""} />
        </View>
      ) : null}

      <Text variant="headline" style={{ marginTop: spacing.lg, marginBottom: spacing.md, color: colors.foreground }}>
        Demo persona
      </Text>
      {!personas.length ? (
        <EmptyState message="No personas available — start the web API on port 3000" />
      ) : (
        <FlatList
          data={personas}
          keyExtractor={(u) => String(u.id)}
          style={{ flexGrow: 0, maxHeight: 360 }}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sign in as ${item.name}`}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                setLocalError(null);
                try {
                  await signInDemo(item.id);
                  router.replace("/(app)");
                } catch (e) {
                  setLocalError(e instanceof Error ? e.message : "Login failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <GlassCard style={{ marginBottom: 0 }}>
                <View style={styles.personaRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="callout">{item.name}</Text>
                    <Text muted>
                      {item.title}
                      {item.region ? ` · ${item.region}` : ""}
                    </Text>
                  </View>
                  <Badge label={item.role.replace(/_/g, " ")} tone="info" />
                </View>
              </GlassCard>
            </Pressable>
          )}
        />
      )}

      <Text variant="headline" style={{ marginTop: spacing.lg, marginBottom: spacing.md, color: colors.foreground }}>
        API token
      </Text>
      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder="pcn_…"
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.muted}
        accessibilityLabel="API token"
        style={[
          styles.input,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            color: colors.foreground,
          },
        ]}
      />
      <Button
        title={busy ? "Signing in…" : "Sign in with token"}
        disabled={busy || !token.trim()}
        onPress={async () => {
          setBusy(true);
          setLocalError(null);
          try {
            await signInToken(token.trim());
            router.replace("/(app)");
          } catch (e) {
            setLocalError(e instanceof Error ? e.message : "Token login failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    marginBottom: spacing.lg,
  },
  personaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
