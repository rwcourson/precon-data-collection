import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { SheetGrid } from "@/src/components/SheetGrid";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";
import {
  canShowSheetArchive,
  parseRouteFlag,
  sheetDisplayName,
} from "@/src/lib/mobile-data-display";

type Row = { id: number; values: Record<string, string | null> };
type Col = { key: string; label: string; type?: string };

export default function SheetDetail() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    id: string;
    pinned?: string;
    canManage?: string;
  }>();
  const { id } = params;

  // Instant UI from list navigation params (same idea as native initiallyPinned).
  const [pinned, setPinned] = useState(() => parseRouteFlag(params.pinned));
  const [canManage, setCanManage] = useState(() => parseRouteFlag(params.canManage));
  const [name, setName] = useState("Sheet");
  const [rows, setRows] = useState<Row[]>([]);
  const [cols, setCols] = useState<Col[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    rowId: number;
    key: string;
    label: string;
    value: string;
  } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [kind, setKind] = useState<"grid" | "view">("grid");
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    setPinned(parseRouteFlag(params.pinned));
    setCanManage(parseRouteFlag(params.canManage));
  }, [params.pinned, params.canManage]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        data: {
          sheet: { name: string; kind?: string };
          columns: Col[];
          rows: Row[];
          kind?: "grid" | "view";
          readOnly?: boolean;
          pinned?: boolean;
          canManage?: boolean;
          pagination: { hasMore: boolean; total?: number };
        };
      }>(`/api/v1/mobile/sheets/${id}?limit=100&offset=0`);
      setName(sheetDisplayName(res.data.sheet.name));
      setReadOnly(!!res.data.readOnly || res.data.kind === "view");
      setKind(res.data.kind === "view" ? "view" : "grid");
      // API is source of truth (overrides list query params when present).
      if (typeof res.data.pinned === "boolean") setPinned(res.data.pinned);
      if (typeof res.data.canManage === "boolean") setCanManage(res.data.canManage);
      const columns = (res.data.columns ?? []).map((c, i) => ({
        key: c.key ?? String((c as { id?: number }).id ?? i),
        label: c.label ?? c.key ?? `Col ${i + 1}`,
        type: c.type,
      }));
      setCols(columns);
      setRows(
        (res.data.rows ?? []).map((r) => ({
          id: r.id,
          values: (r.values ?? {}) as Record<string, string | null>,
        })),
      );
      setHasMore(res.data.pagination.hasMore);
      setTotal(res.data.pagination.total ?? res.data.rows?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const showArchive = canShowSheetArchive(canManage);

  return (
    <Screen>
      <GlassHeader
        title={name}
        subtitle={
          total
            ? `${kind === "view" ? "View · " : "Grid · "}${rows.length}${hasMore ? "+" : ""} of ${total} · ${cols.length} cols${readOnly ? " · read-only" : ""}`
            : kind === "view"
              ? "Pursuit view"
              : undefined
        }
      />
      <View style={styles.toolbar}>
        <Button
          title={pinned ? "Unpin" : "Pin"}
          variant="secondary"
          disabled={actionBusy}
          onPress={async () => {
            setActionBusy(true);
            try {
              const res = await apiFetch<{ pinned?: boolean }>(
                `/api/v1/mobile/sheets/${id}`,
                {
                  method: "PATCH",
                  body: JSON.stringify({ action: "pin" }),
                },
              );
              if (typeof res.pinned === "boolean") setPinned(res.pinned);
              else setPinned((p) => !p);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Pin failed");
            } finally {
              setActionBusy(false);
            }
          }}
          style={{ flex: 1 }}
        />
        {!readOnly ? (
          <Button
            title="Add row"
            variant="secondary"
            disabled={actionBusy}
            onPress={async () => {
              setActionBusy(true);
              try {
                await apiFetch(`/api/v1/mobile/sheets/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ action: "add-row" }),
                });
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Add row failed");
              } finally {
                setActionBusy(false);
              }
            }}
            style={{ flex: 1 }}
          />
        ) : null}
        {showArchive ? (
          <Button
            title="Archive"
            variant="ghost"
            disabled={actionBusy}
            onPress={async () => {
              setActionBusy(true);
              try {
                await apiFetch(`/api/v1/mobile/sheets/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ action: "archive" }),
                });
                router.back();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Archive failed");
                setActionBusy(false);
              }
            }}
            style={{ flex: 1 }}
          />
        ) : null}
      </View>

      {loading ? (
        <LoadingState label="Loading sheet…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : cols.length === 0 ? (
        <EmptyState message="This sheet has no columns yet" />
      ) : rows.length === 0 ? (
        <EmptyState message="No rows — tap Add row" />
      ) : (
        <View style={styles.gridWrap}>
          <Text muted variant="caption" style={styles.hint}>
            Swipe sideways to scan columns · tap a cell to edit
            {readOnly ? " (view is read-only)" : ""}
          </Text>
          <SheetGrid
            columns={cols}
            rows={rows}
            readOnly={readOnly}
            onCellPress={
              readOnly
                ? undefined
                : (args) =>
                    setEdit({
                      rowId: args.rowId,
                      key: args.key,
                      label: args.label,
                      value: args.value,
                    })
            }
          />
        </View>
      )}

      <Modal visible={!!edit} transparent animationType="slide">
        <View style={[styles.modal, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
          <GlassCard>
            <Text variant="headline" style={{ color: colors.foreground }}>
              Edit cell
            </Text>
            <Text muted variant="caption" style={{ marginBottom: spacing.sm }}>
              {edit?.label ?? ""}
            </Text>
            <TextInput
              value={edit?.value ?? ""}
              onChangeText={(v) => edit && setEdit({ ...edit, value: v })}
              placeholderTextColor={colors.muted}
              autoFocus
              style={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: 12,
                marginBottom: 12,
                backgroundColor: colors.input,
                color: colors.foreground,
                minHeight: 44,
                fontFamily: "Manrope_400Regular",
                fontSize: 15,
              }}
            />
            <Button
              title={saving ? "Saving…" : "Save"}
              disabled={saving}
              onPress={async () => {
                if (!edit) return;
                setSaving(true);
                try {
                  await apiFetch(`/api/v1/mobile/sheets/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      cell: {
                        rowId: edit.rowId,
                        key: edit.key,
                        value: edit.value,
                      },
                    }),
                  });
                  setEdit(null);
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Save failed");
                } finally {
                  setSaving(false);
                }
              }}
            />
            <Button title="Cancel" variant="ghost" onPress={() => setEdit(null)} />
          </GlassCard>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  gridWrap: { flex: 1 },
  hint: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  modal: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
});
