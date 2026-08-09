import { Link, Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { Text } from "@/src/components/ui/Text";
import { Screen } from "@/src/components/ui/Screen";
import { useTheme } from "@/src/theme/ThemeContext";
import { spacing } from "@/src/theme/tokens";

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen style={styles.container}>
        <Text variant="headline">Screen not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={{ color: colors.brand }}>Go to Overview</Text>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  link: { marginTop: spacing.md },
});
