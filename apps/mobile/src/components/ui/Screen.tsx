import { View, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";

/** Full-screen canvas using themed background (light sheet / dark canvas). */
export function Screen({
  style,
  children,
  ...rest
}: ViewProps & { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]} {...rest}>
      {children}
    </View>
  );
}
