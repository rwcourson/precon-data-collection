import { BlurView } from "expo-blur";
import {
  Platform,
  StyleSheet,
  View,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { blur, radii } from "../../theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";

type Props = ViewProps & {
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/** Liquid-glass surface — mode-aware fill/border for light + dark. */
export function GlassView({ intensity = blur.glass, style, children, ...rest }: Props) {
  const { colors, isDark } = useTheme();
  const surface = {
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
  };

  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={intensity}
        tint={isDark ? "dark" : "light"}
        style={[styles.base, surface, style]}
        {...rest}
      >
        {children}
      </BlurView>
    );
  }
  return (
    <View
      style={[
        styles.base,
        surface,
        { backgroundColor: isDark ? "rgba(28,28,31,0.94)" : "rgba(255,255,255,0.94)" },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
