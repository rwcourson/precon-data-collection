import { useMemo } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/src/components/ui/Text";
import { useTheme } from "@/src/theme/ThemeContext";
import {
  buildSheetGridMatrix,
  type SheetColumnLike,
  type SheetRowLike,
} from "@/src/lib/mobile-data-display";

const ROW_H = 44;
const HEADER_H = 42;
const GUTTER_W = 44;

type Props = {
  columns: SheetColumnLike[];
  rows: SheetRowLike[];
  readOnly?: boolean;
  onCellPress?: (args: {
    rowId: number;
    key: string;
    label: string;
    value: string;
  }) => void;
};

/**
 * Smartsheet-style scannable grid:
 * one horizontal axis for columns, vertical axis for rows.
 * Avoids nested flex ScrollViews that collapse headers into a vertical stack.
 */
export function SheetGrid({ columns, rows, readOnly, onCellPress }: Props) {
  const { colors, isDark } = useTheme();

  const matrix = useMemo(
    () => buildSheetGridMatrix(columns, rows),
    [columns, rows],
  );

  const totalWidth = useMemo(
    () => GUTTER_W + matrix.widths.reduce((s, w) => s + w, 0),
    [matrix.widths],
  );

  const headerBg = isDark ? "#1e2636" : "#eef2f8";
  const altBg = isDark ? "rgba(255,255,255,0.035)" : "rgba(12,32,72,0.035)";
  const border = colors.border;

  const Header = (
    <View
      style={[
        styles.row,
        {
          width: totalWidth,
          height: HEADER_H,
          backgroundColor: headerBg,
          borderBottomColor: border,
          borderBottomWidth: StyleSheet.hairlineWidth * 2,
        },
      ]}
    >
      <View
        style={[
          styles.gutter,
          { borderRightColor: border, backgroundColor: headerBg },
        ]}
      >
        <Text variant="micro" muted>
          #
        </Text>
      </View>
      {matrix.headers.map((h, i) => (
        <View
          key={matrix.keys[i] ?? `h-${i}`}
          style={[
            styles.cell,
            {
              width: matrix.widths[i],
              borderRightColor: border,
              backgroundColor: headerBg,
            },
          ]}
        >
          <Text
            variant="micro"
            numberOfLines={2}
            style={{ color: colors.foreground, fontFamily: "Manrope_600SemiBold" }}
          >
            {h}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator
        style={styles.hScroll}
        contentContainerStyle={{ width: totalWidth }}
      >
        <View style={{ width: totalWidth, flex: 1 }}>
          {Header}
          <FlatList
            data={matrix.body}
            keyExtractor={(item) => String(item.rowId)}
            style={styles.vList}
            contentContainerStyle={{ paddingBottom: 100 }}
            initialNumToRender={24}
            windowSize={9}
            renderItem={({ item, index }) => (
              <View
                style={[
                  styles.row,
                  {
                    width: totalWidth,
                    height: ROW_H,
                    backgroundColor: index % 2 === 1 ? altBg : "transparent",
                    borderBottomColor: border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View style={[styles.gutter, { borderRightColor: border }]}>
                  <Text variant="micro" muted>
                    {index + 1}
                  </Text>
                </View>
                {item.cells.map((cell, colIdx) => {
                  const key = matrix.keys[colIdx];
                  const label = matrix.headers[colIdx];
                  const raw =
                    rows.find((r) => r.id === item.rowId)?.values?.[key] ?? "";
                  return (
                    <Pressable
                      key={`${item.rowId}:${key}`}
                      disabled={readOnly || !onCellPress}
                      onPress={() =>
                        onCellPress?.({
                          rowId: item.rowId,
                          key,
                          label,
                          value: String(raw ?? ""),
                        })
                      }
                      style={({ pressed }) => [
                        styles.cell,
                        {
                          width: matrix.widths[colIdx],
                          borderRightColor: border,
                          backgroundColor:
                            pressed && !readOnly
                              ? colors.mutedSoft
                              : "transparent",
                        },
                      ]}
                      accessibilityRole={readOnly ? "text" : "button"}
                      accessibilityLabel={
                        readOnly ? `${label}: ${cell}` : `Edit ${label}`
                      }
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          color: cell === "—" ? colors.muted : colors.foreground,
                          fontSize: 13,
                          fontFamily: "Manrope_400Regular",
                        }}
                      >
                        {cell}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 200 },
  hScroll: { flex: 1 },
  vList: { flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    // Critical: do not flex-shrink columns into a vertical stack
    flexWrap: "nowrap",
  },
  gutter: {
    width: GUTTER_W,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    paddingHorizontal: 8,
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
});
