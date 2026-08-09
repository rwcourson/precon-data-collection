import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { radii, spacing, typography } from "../../theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

export function Button({
  title,
  variant = "primary",
  disabled,
  style,
  ...rest
}: PressableProps & {
  title: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "destructive"
        ? colors.destructive
        : variant === "secondary"
          ? colors.secondary
          : "transparent";
  const fg =
    variant === "primary" || variant === "destructive"
      ? colors.primaryForeground
      : colors.secondaryForeground;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          alignItems: "center" as const,
          backgroundColor: bg,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text style={{ ...typography.callout, color: fg, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
}
