import { View, StyleSheet } from "react-native";
import { Text } from "@/src/components/ui/Text";
import { useTheme } from "@/src/theme/ThemeContext";
import { spacing, radii } from "@/src/theme/tokens";

/** Chart chrome — title, optional subtitle/legend, framed content (chart-elements frame intent). */
export function ChartFrame({
  title,
  subtitle,
  legend,
  children,
  empty,
  emptyLabel = "No series data",
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  children: React.ReactNode;
  empty?: boolean;
  emptyLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.frame,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
      ]}
    >
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="callout" style={{ color: colors.foreground }}>
            {title}
          </Text>
          {subtitle ? (
            <Text muted variant="caption" style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {legend && legend.length > 0 ? (
        <View style={styles.legend}>
          {legend.map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: l.color }]} />
              <Text variant="micro" muted>
                {l.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {empty ? (
        <View style={styles.empty}>
          <Text muted>{emptyLabel}</Text>
        </View>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  head: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.sm },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  body: { minHeight: 160, alignItems: "center" },
  empty: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
});
