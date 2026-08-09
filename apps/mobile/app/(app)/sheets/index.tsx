import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { Icon } from "@/src/components/ui/Icon";
import { ICON_DEFAULTS } from "@/src/theme/tokens";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassView } from "@/src/components/ui/GlassView";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { ListRow } from "@/src/components/ui/ListRow";
import { Chip, ChipRow } from "@/src/components/ui/Chip";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import {
  filterSheetsByQuery,
  groupSheetsByFolder,
  sheetDisplayName,
  sheetFolderLabel,
  sheetListSubtitle,
  sortSheetsForList,
} from "@/src/lib/mobile-data-display";

type Sheet = {
  id: number;
  name: string;
  folder: string;
  kind: string;
  pinned: boolean;
  canManage: boolean;
  rowCount: number;
  description?: string | null;
};

type ArchivedSheet = {
  id: number;
  name: string;
  folder: string;
  archivedAt: string;
  canRestore: boolean;
};

export default function SheetsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [rows, setRows] = useState<Sheet[]>([]);
  const [archived, setArchived] = useState<ArchivedSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "view" | "grid">("all");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    // Never force full-screen spinner on focus refresh when we already have data
    // (avoids flash after Archive → router.back).
    setError(null);
    try {
      const [activeRes, archivedRes] = await Promise.all([
        apiFetch<{ data: Sheet[] }>("/api/v1/mobile/sheets"),
        apiFetch<{ data: ArchivedSheet[] }>("/api/v1/mobile/sheets?archived=1"),
      ]);
      setRows(activeRes.data ?? []);
      setArchived(archivedRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when returning from detail (e.g. after Archive) — not only on mount.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const patchSheet = async (id: number, action: "pin" | "archive" | "restore") => {
    setBusyId(id);
    try {
      await apiFetch(`/api/v1/mobile/sheets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusyId(null);
    }
  };

  const createSheet = async () => {
    const n = name.trim() || `Mobile sheet ${Date.now()}`;
    setCreating(true);
    try {
      const res = await apiFetch<{ id: number; data?: { id: number } }>(
        "/api/v1/mobile/sheets",
        {
          method: "POST",
          body: JSON.stringify({
            name: n,
            kind: "grid",
            folder: "Mobile",
          }),
        },
      );
      const id = res.id ?? res.data?.id;
      setCreateOpen(false);
      setName("");
      if (id) {
        router.push(
          `/(app)/sheets/${id}?pinned=0&canManage=1` as `/(app)/sheets/${string}`,
        );
      } else load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const visible = useMemo(() => {
    let list = rows.filter((s) => {
      if (filter === "all") return true;
      if (filter === "view") return s.kind === "view";
      return s.kind !== "view";
    });
    list = filterSheetsByQuery(list, query);
    return sortSheetsForList(list);
  }, [rows, filter, query]);

  const sections = useMemo(
    () =>
      groupSheetsByFolder(visible).map((g) => ({
        title: g.folder,
        data: g.sheets,
      })),
    [visible],
  );

  const archivedVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return archived;
    return archived.filter((s) => {
      const hay = [
        sheetDisplayName(s.name),
        s.name,
        sheetFolderLabel(s.folder),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [archived, query]);

  const viewCount = rows.filter((s) => s.kind === "view").length;
  const gridCount = rows.filter((s) => s.kind !== "view").length;
  const canCreate = !!user && !["leadership"].includes(user.role);

  const confirmArchive = (item: Sheet) => {
    Alert.alert(
      "Archive sheet?",
      `${sheetDisplayName(item.name)} will move to Archived. You can restore it later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: () => void patchSheet(item.id, "archive"),
        },
      ],
    );
  };

  return (
    <Screen>
      <GlassHeader
        title="Sheets"
        subtitle={
          showArchived
            ? `${archivedVisible.length} archived`
            : `${visible.length} of ${rows.length}`
        }
      />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={showArchived ? "Find archived…" : "Find a sheet…"}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[
            styles.search,
            {
              borderColor: colors.border,
              backgroundColor: colors.input,
              color: colors.foreground,
            },
          ]}
          accessibilityLabel="Search sheets"
        />
      </View>
      <ChipRow>
        {!showArchived ? (
          <>
            <Chip
              label={rows.length ? `All · ${rows.length}` : "All"}
              selected={filter === "all"}
              onPress={() => setFilter("all")}
            />
            <Chip
              label={viewCount ? `Views · ${viewCount}` : "Views"}
              selected={filter === "view"}
              onPress={() => setFilter("view")}
            />
            <Chip
              label={gridCount ? `Grids · ${gridCount}` : "Grids"}
              selected={filter === "grid"}
              onPress={() => setFilter("grid")}
            />
          </>
        ) : null}
        <Chip
          label={
            archived.length
              ? `Archived · ${showArchived ? archivedVisible.length : archived.length}`
              : "Archived"
          }
          selected={showArchived}
          onPress={() => setShowArchived((v) => !v)}
        />
      </ChipRow>
      {canCreate && !showArchived ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <Button title="Create grid sheet" onPress={() => setCreateOpen(true)} />
        </View>
      ) : null}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : showArchived ? (
        archivedVisible.length === 0 ? (
          <EmptyState
            message={
              query.trim()
                ? `No archived sheets match “${query.trim()}”`
                : "No archived sheets"
            }
          />
        ) : (
          <SectionList
            sections={[{ title: "Archived", data: archivedVisible }]}
            keyExtractor={(s) => String(s.id)}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text variant="caption" style={{ color: colors.muted, fontWeight: "600" }}>
                  {section.title}
                </Text>
                <Text variant="caption" style={{ color: colors.muted }}>
                  {section.data.length}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <ListRow
                title={sheetDisplayName(item.name)}
                subtitle={`${sheetFolderLabel(item.folder)} · archived`}
                icon="archive"
                chevron={false}
                right={
                  item.canRestore ? (
                    <Pressable
                      onPress={() => void patchSheet(item.id, "restore")}
                      disabled={busyId === item.id}
                      accessibilityLabel={`Restore ${sheetDisplayName(item.name)}`}
                      hitSlop={8}
                      style={{ padding: 6 }}
                    >
                      <Text variant="caption" style={{ color: colors.foreground, fontWeight: "600" }}>
                        {busyId === item.id ? "…" : "Restore"}
                      </Text>
                    </Pressable>
                  ) : null
                }
              />
            )}
          />
        )
      ) : visible.length === 0 ? (
        <EmptyState
          message={
            query.trim()
              ? `No sheets match “${query.trim()}”`
              : "No sheets in this filter"
          }
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="caption" style={{ color: colors.muted, fontWeight: "600" }}>
                {section.title}
              </Text>
              <Text variant="caption" style={{ color: colors.muted }}>
                {section.data.length}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ListRow
              title={sheetDisplayName(item.name)}
              subtitle={sheetListSubtitle(item)}
              icon={item.kind === "view" ? "eye" : "grid"}
              onPress={() =>
                router.push(
                  `/(app)/sheets/${item.id}?pinned=${item.pinned ? 1 : 0}&canManage=${item.canManage ? 1 : 0}` as `/(app)/sheets/${string}`,
                )
              }
              right={
                <View style={styles.rowActions}>
                  <Pressable
                    onPress={() => void patchSheet(item.id, "pin")}
                    disabled={busyId === item.id}
                    accessibilityLabel={
                      item.pinned
                        ? `Unpin ${sheetDisplayName(item.name)}`
                        : `Pin ${sheetDisplayName(item.name)}`
                    }
                    hitSlop={8}
                    style={styles.iconBtn}
                  >
                    <Icon
                      name="pin"
                      size={ICON_DEFAULTS.chromeSize}
                      color={item.pinned ? colors.foreground : colors.muted}
                      active={item.pinned}
                    />
                  </Pressable>
                  {item.canManage ? (
                    <Pressable
                      onPress={() => confirmArchive(item)}
                      disabled={busyId === item.id}
                      accessibilityLabel={`Archive ${sheetDisplayName(item.name)}`}
                      hitSlop={8}
                      style={styles.iconBtn}
                    >
                      <Icon
                        name="archive"
                        size={ICON_DEFAULTS.chromeSize}
                        color={colors.muted}
                      />
                    </Pressable>
                  ) : null}
                </View>
              }
            />
          )}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <GlassView intensity={50} style={styles.modalCard}>
            <Text variant="headline" style={{ color: colors.foreground, marginBottom: spacing.md }}>
              New sheet
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Sheet name"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                  color: colors.foreground,
                },
              ]}
            />
            <View style={styles.actions}>
              <Button title="Cancel" variant="ghost" onPress={() => setCreateOpen(false)} style={{ flex: 1 }} />
              <Button
                title={creating ? "Creating…" : "Create"}
                onPress={createSheet}
                disabled={creating}
                style={{ flex: 1 }}
              />
            </View>
          </GlassView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { padding: 6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: 12,
    minHeight: 44,
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
});
