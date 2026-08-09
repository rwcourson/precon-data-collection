import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { GlassView } from "./GlassView";
import { radii, spacing } from "../../theme/tokens";

export function GlassCard({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <GlassView style={[styles.card, style]}>{children}</GlassView>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
});
