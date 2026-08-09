import { Redirect, Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useAuth } from "@/src/context/AuthContext";
import { LoadingState } from "@/src/components/StateViews";
import { useTheme } from "@/src/theme/ThemeContext";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { TabIcon, type PreconIconName } from "@/src/components/ui/Icon";
import { ICON_DEFAULTS } from "@/src/theme/tokens";

function tabIcon(name: PreconIconName) {
  return ({
    color,
    size,
    focused,
  }: {
    color: string | import("react-native").OpaqueColorValue;
    size: number;
    focused: boolean;
  }) => (
    <TabIcon
      name={name}
      color={color as string}
      focused={focused}
      size={size ?? ICON_DEFAULTS.tabSize}
    />
  );
}

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();

  if (loading) return <LoadingState label="Opening Precon…" />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <OfflineBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.foreground,
          tabBarInactiveTintColor: colors.muted,
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={80}
                tint={isDark ? "dark" : "light"}
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                    backgroundColor: colors.tabBar,
                  },
                ]}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: colors.tabBar },
                ]}
              />
            ),
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "transparent",
            borderTopColor: "transparent",
            elevation: 0,
            height: Platform.OS === "ios" ? 88 : 64,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontFamily: "Manrope_500Medium",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Overview",
            tabBarAccessibilityLabel: "Overview",
            tabBarIcon: tabIcon("home"),
          }}
        />
        <Tabs.Screen
          name="schedule/index"
          options={{
            title: "Schedule",
            href: "/(app)/schedule",
            tabBarAccessibilityLabel: "Bid Schedule",
            tabBarIcon: tabIcon("calendar"),
          }}
        />
        <Tabs.Screen
          name="post-bid/index"
          options={{
            title: "Post-Bid",
            href: "/(app)/post-bid",
            tabBarAccessibilityLabel: "Post-Bid",
            tabBarIcon: tabIcon("pen"),
          }}
        />
        <Tabs.Screen
          name="sheets/index"
          options={{
            title: "Sheets",
            href: "/(app)/sheets",
            tabBarAccessibilityLabel: "Sheets",
            tabBarIcon: tabIcon("grid"),
          }}
        />
        <Tabs.Screen
          name="more/index"
          options={{
            title: "More",
            href: "/(app)/more",
            tabBarAccessibilityLabel: "More",
            tabBarIcon: tabIcon("more"),
          }}
        />
        <Tabs.Screen name="schedule/[jobId]" options={{ href: null }} />
        <Tabs.Screen name="post-bid/[roundId]" options={{ href: null }} />
        <Tabs.Screen name="sheets/[id]" options={{ href: null }} />
        <Tabs.Screen name="more/search" options={{ href: null }} />
        <Tabs.Screen name="more/notifications" options={{ href: null }} />
        <Tabs.Screen name="more/settings" options={{ href: null }} />
        <Tabs.Screen name="more/dashboards" options={{ href: null }} />
        <Tabs.Screen name="more/forecast" options={{ href: null }} />
        <Tabs.Screen name="more/reconciliation" options={{ href: null }} />
        <Tabs.Screen name="more/studio" options={{ href: null }} />
        <Tabs.Screen name="more/studio/[id]" options={{ href: null }} />
        <Tabs.Screen name="more/magnus" options={{ href: null }} />
        <Tabs.Screen name="more/reports" options={{ href: null }} />
        <Tabs.Screen name="more/annual" options={{ href: null }} />
        <Tabs.Screen name="more/admin" options={{ href: null }} />
        <Tabs.Screen name="more/admin/[section]" options={{ href: null }} />
        <Tabs.Screen name="more/trash" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
