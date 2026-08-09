import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { Text } from "@/src/components/ui/Text";
import { ListRow } from "@/src/components/ui/ListRow";
import type { PreconIconName } from "@/src/components/ui/Icon";
import { useTheme } from "@/src/theme/ThemeContext";
import { spacing } from "@/src/theme/tokens";

type Item = {
  href: string;
  title: string;
  sub: string;
  icon: PreconIconName;
};

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Dashboards & AI",
    items: [
      { href: "/(app)/more/dashboards", title: "Dashboards", sub: "Corporate · region · division", icon: "chart" },
      { href: "/(app)/more/studio", title: "Dashboard Studio", sub: "Build personal boards", icon: "palette" },
      { href: "/(app)/more/forecast", title: "Forecast", sub: "Projection curves", icon: "trending" },
      { href: "/(app)/more/reconciliation", title: "DMR Reconciliation", sub: "Upload & compare", icon: "compare" },
      { href: "/(app)/more/magnus", title: "Magnus AI", sub: "Ask Precon data", icon: "sparkles" },
    ],
  },
  {
    title: "Reports & ops",
    items: [
      { href: "/(app)/more/reports", title: "Reports", sub: "Builder · export", icon: "fileText" },
      { href: "/(app)/more/annual", title: "Annual Report", sub: "Yearbook view", icon: "book" },
      { href: "/(app)/more/admin", title: "Admin", sub: "Governance · Destini", icon: "shield" },
      { href: "/(app)/more/trash", title: "Trash", sub: "Restore soft-deletes", icon: "trash" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/(app)/more/search", title: "Search", sub: "Jobs & sheets", icon: "search" },
      { href: "/(app)/more/notifications", title: "Notifications", sub: "Alerts & reminders", icon: "bell" },
      { href: "/(app)/more/settings", title: "Settings", sub: "Theme · persona · workspace", icon: "settings" },
    ],
  },
];

export default function MoreScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <GlassHeader title="More" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text
              variant="micro"
              style={{
                color: colors.muted,
                letterSpacing: 0.9,
                marginBottom: spacing.sm,
              }}
            >
              {section.title.toUpperCase()}
            </Text>
            {section.items.map((i) => (
              <ListRow
                key={i.href}
                title={i.title}
                subtitle={i.sub}
                icon={i.icon}
                onPress={() => router.push(i.href as never)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
});
