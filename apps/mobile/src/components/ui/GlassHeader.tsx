import { StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView } from "./GlassView";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { blur, ICON_DEFAULTS, spacing } from "../../theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onSearch?: () => void;
  onNotifications?: () => void;
  onThemeToggle?: () => void;
};

export function GlassHeader({
  title,
  subtitle,
  right,
  onSearch,
  onNotifications,
  onThemeToggle,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, cyclePreference } = useTheme();
  const toggle = onThemeToggle ?? cyclePreference;

  return (
    <GlassView
      intensity={blur.chrome}
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + spacing.sm,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="title" style={{ color: colors.foreground }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text muted variant="caption" style={{ marginTop: 2 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onSearch ? (
          <Pressable
            onPress={onSearch}
            accessibilityLabel="Search"
            accessibilityRole="button"
            style={[styles.iconBtn, { backgroundColor: colors.iconBtn }]}
          >
            <Icon
              name="search"
              size={ICON_DEFAULTS.chromeSize}
              color={colors.icon}
            />
          </Pressable>
        ) : null}
        {onNotifications ? (
          <Pressable
            onPress={onNotifications}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            style={[styles.iconBtn, { backgroundColor: colors.iconBtn }]}
          >
            <Icon
              name="bell"
              size={ICON_DEFAULTS.chromeSize}
              color={colors.icon}
            />
          </Pressable>
        ) : null}
        <Pressable
          onPress={toggle}
          accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
          accessibilityRole="button"
          style={[styles.iconBtn, { backgroundColor: colors.iconBtn }]}
        >
          <Icon
            name={isDark ? "sun" : "moon"}
            size={ICON_DEFAULTS.chromeSize}
            color={colors.icon}
          />
        </Pressable>
        {right}
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
