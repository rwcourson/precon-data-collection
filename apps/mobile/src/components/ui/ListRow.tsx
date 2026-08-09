import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { GlassCard } from "./GlassCard";
import { Text } from "./Text";
import { Icon, type PreconIconName } from "./Icon";
import { ICON_DEFAULTS, spacing } from "@/src/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  icon?: PreconIconName;
  onPress?: () => void;
  right?: React.ReactNode;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Icon + title + subtitle glass list row — thin Lucide + grey chrome. */
export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  right,
  chevron = true,
  style,
}: Props) {
  const { colors } = useTheme();
  const body = (
    <GlassCard style={[{ marginBottom: spacing.sm }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        {icon ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.iconBtn,
            }}
          >
            <Icon
              name={icon}
              size={ICON_DEFAULTS.size}
              color={colors.icon}
              strokeWidth={ICON_DEFAULTS.strokeWidth}
            />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="headline" style={{ color: colors.foreground }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text muted numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
        {chevron && onPress ? (
          <Icon
            name="chevronRight"
            size={ICON_DEFAULTS.chromeSize}
            color={colors.muted}
            strokeWidth={ICON_DEFAULTS.strokeWidth}
          />
        ) : null}
      </View>
    </GlassCard>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      {body}
    </Pressable>
  );
}
