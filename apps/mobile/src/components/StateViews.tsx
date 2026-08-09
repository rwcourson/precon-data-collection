import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "./ui/Text";
import { spacing } from "../theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityLabel={label}>
      <ActivityIndicator color={colors.muted} />
      <Text muted style={{ marginTop: spacing.sm }}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text muted>{message}</Text>
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={{ color: colors.destructive, textAlign: "center" }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    minHeight: 120,
  },
});
