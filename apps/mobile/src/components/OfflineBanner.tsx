import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./ui/Text";
import { spacing } from "../theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    const g = globalThis as typeof globalThis & {
      addEventListener?: (type: string, fn: () => void) => void;
      removeEventListener?: (type: string, fn: () => void) => void;
      navigator?: { onLine?: boolean };
    };
    g.addEventListener?.("offline", off);
    g.addEventListener?.("online", on);
    if (g.navigator?.onLine === false) setOffline(true);
    return () => {
      g.removeEventListener?.("offline", off);
      g.removeEventListener?.("online", on);
    };
  }, []);

  if (!offline) return null;
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.warning }]}
      accessibilityRole="alert"
    >
      <Text style={{ color: colors.primaryForeground }}>
        You are offline — reconnect to sync Precon data.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
