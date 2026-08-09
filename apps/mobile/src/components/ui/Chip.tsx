import {
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { Text } from "./Text";
import { spacing } from "@/src/theme/tokens";

type Props = PressableProps & {
  label: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Glass-friendly filter/segment chip. */
export function Chip({ label, selected, style, disabled, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: selected ? colors.chipOn : colors.chip,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        style,
      ]}
      {...rest}
    >
      <Text
        variant="micro"
        style={{
          color: selected ? colors.chipOnText : colors.chipText,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          paddingHorizontal: spacing.lg,
          marginVertical: 4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
