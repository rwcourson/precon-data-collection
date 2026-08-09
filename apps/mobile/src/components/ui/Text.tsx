import { Text as RNText, type TextProps, type StyleProp, type TextStyle } from "react-native";
import { typography } from "../../theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";

type Variant = keyof typeof typography;

export function Text({
  variant = "body",
  muted,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <RNText
      style={[
        { color: muted ? colors.muted : colors.foreground },
        typography[variant],
        style,
      ]}
      {...rest}
    />
  );
}
