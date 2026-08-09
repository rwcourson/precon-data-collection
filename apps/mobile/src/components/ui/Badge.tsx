import { View, StyleSheet } from "react-native";
import { radii, typography } from "../../theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";
import { Text } from "./Text";

type Tone = "default" | "success" | "warning" | "info" | "destructive";

export function Badge({ label, tone = "default" }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const map: Record<Tone, { bg: string; fg: string }> = {
    default: { bg: colors.mutedSoft, fg: colors.foreground },
    success: { bg: colors.successSoft, fg: colors.successForeground },
    warning: { bg: colors.warningSoft, fg: colors.warningForeground },
    info: { bg: colors.infoSoft, fg: colors.infoForeground },
    destructive: { bg: colors.destructiveSoft, fg: colors.destructiveForeground },
  };
  const t = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={{ ...typography.micro, color: t.fg, textTransform: "uppercase" }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
});
