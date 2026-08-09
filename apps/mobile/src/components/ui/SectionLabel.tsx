import { StyleSheet, type StyleProp, type TextStyle } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/src/theme/ThemeContext";
import { spacing } from "@/src/theme/tokens";

/** Micro section label used across polished screens. */
export function SectionLabel({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Text
      variant="micro"
      style={[
        styles.label,
        { color: colors.muted },
        style,
      ]}
    >
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    letterSpacing: 0.85,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
});
