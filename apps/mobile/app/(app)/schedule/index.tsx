import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { GlassHeader } from "@/src/components/ui/GlassHeader";
import { Screen } from "@/src/components/ui/Screen";
import { GlassCard } from "@/src/components/ui/GlassCard";
import { GlassView } from "@/src/components/ui/GlassView";
import { Text } from "@/src/components/ui/Text";
import { Button } from "@/src/components/ui/Button";
import { Chip, ChipRow } from "@/src/components/ui/Chip";
import { StatusBadge } from "@/src/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/StateViews";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import {
  formatDueDateHuman,
  groupRowsByDueBand,
  type DueBand,
} from "@/src/lib/mobile-data-display";

type Row = {
  roundId: number;
  jobId: number;
  jobName: string;
  jobNumber: string;
  status: string;
  estimatePhase: string;
  bidDueDate: string | null;
  groupKey: string | null;
  estimateValue?: number | null;
  preconDepartment?: string;
  marketSector?: string | null;
};

/** Match web bid-schedule page section labels */
const SECTIONS: { key: "all" | "active" | "upcoming" | "outstanding"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "outstanding", label: "Outstanding" },
];

/** Match web BID_SCHEDULE_GROUP_OPTIONS */
const GROUPS: {
  key: "none" | "preconDepartment" | "marketSector" | "estimatePhase" | "bidDueDate";
  label: string;
}[] = [
  { key: "none", label: "No grouping" },
  { key: "preconDepartment", label: "Division" },
  { key: "marketSector", label: "Market sector" },
  { key: "estimatePhase", label: "Estimate phase" },
  { key: "bidDueDate", label: "Bid due date" },
];

type SortKey = "bidDueDate" | "jobName" | "status" | "estimatePhase";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "bidDueDate", label: "Due date" },
  { key: "jobName", label: "Job name" },
  { key: "status", label: "Status" },
  { key: "estimatePhase", label: "Phase" },
];

function formatDue(iso: string | null): string {
  return formatDueDateHuman(iso);
}

const BAND_ACCENT: Record<DueBand, string> = {
  overdue: "#b33a2b",
  this_week: "#c9762b",
  next_week: "#3d5a8c",
  later: "#5f8f5a",
  none: "#6b7c99",
};

function dueSortKey(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function compareRows(a: Row, b: Row, sort: SortKey, dir: "asc" | "desc"): number {
  let cmp = 0;
  switch (sort) {
    case "bidDueDate":
      cmp = dueSortKey(a.bidDueDate) - dueSortKey(b.bidDueDate);
      break;
    case "jobName":
      cmp = a.jobName.localeCompare(b.jobName, undefined, { sensitivity: "base" });
      break;
    case "status":
      cmp = a.status.localeCompare(b.status);
      break;
    case "estimatePhase":
      cmp = a.estimatePhase.localeCompare(b.estimatePhase);
      break;
  }
  if (cmp === 0) {
    cmp = a.jobName.localeCompare(b.jobName, undefined, { sensitivity: "base" });
  }
  return dir === "asc" ? cmp : -cmp;
}

type ListItem =
  | { type: "header"; key: string; title: string; count: number }
  | { type: "row"; key: string; row: Row };

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [section, setSection] = useState<(typeof SECTIONS)[number]["key"]>("all");
  const [groupBy, setGroupBy] = useState<(typeof GROUPS)[number]["key"]>("none");
  const [sort, setSort] = useState<SortKey>("bidDueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  /** list = classic chips; timeline = Smartsheet-style due-date bands */
  const [viewMode, setViewMode] = useState<"list" | "timeline">("timeline");
  const [rows, setRows] = useState<Row[]>([]);
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [jobName, setJobName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [bidDueDate, setBidDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const canCreate = user && !["leadership"].includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        data: Row[];
        sections?: { key: string; count: number }[];
      }>(`/api/v1/mobile/bid-schedule?section=${section}&groupBy=${groupBy}`);
      setRows(res.data ?? []);
      const counts: Record<string, number> = {};
      for (const s of res.sections ?? []) counts[s.key] = s.count;
      setSectionCounts(counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [section, groupBy]);

  useEffect(() => {
    load();
  }, [load]);

  const listItems = useMemo((): ListItem[] => {
    if (viewMode === "timeline") {
      // Smartsheet-inspired: Overdue → This week → Next week → Later → No due date
      const bands = groupRowsByDueBand(rows);
      const items: ListItem[] = [];
      for (const g of bands) {
        items.push({
          type: "header",
          key: `band:${g.band}`,
          title: g.label,
          count: g.rows.length,
        });
        for (const row of g.rows) {
          items.push({ type: "row", key: String(row.roundId), row });
        }
      }
      return items;
    }

    const sorted = [...rows].sort((a, b) => compareRows(a, b, sort, sortDir));

    if (groupBy === "none") {
      return sorted.map((row) => ({
        type: "row" as const,
        key: String(row.roundId),
        row,
      }));
    }

    // Group by API groupKey (or blank)
    const buckets = new Map<string, Row[]>();
    for (const row of sorted) {
      const label = (row.groupKey && String(row.groupKey).trim()) || "(blank)";
      const list = buckets.get(label) ?? [];
      list.push(row);
      buckets.set(label, list);
    }

    // Sort group headers: blank last; dates chronologically when grouping by due date
    const keys = Array.from(buckets.keys()).sort((a, b) => {
      if (a === "(blank)") return 1;
      if (b === "(blank)") return -1;
      if (groupBy === "bidDueDate") {
        return dueSortKey(a === "(blank)" ? null : a) - dueSortKey(b === "(blank)" ? null : b);
      }
      return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    });

    const items: ListItem[] = [];
    for (const k of keys) {
      const groupRows = buckets.get(k) ?? [];
      const title =
        groupBy === "bidDueDate" && k !== "(blank)"
          ? formatDue(k)
          : k === "(blank)"
            ? "Unspecified"
            : k;
      items.push({
        type: "header",
        key: `h:${k}`,
        title,
        count: groupRows.length,
      });
      for (const row of groupRows) {
        items.push({ type: "row", key: String(row.roundId), row });
      }
    }
    return items;
  }, [rows, groupBy, sort, sortDir, viewMode]);

  const createPursuit = async () => {
    const name = jobName.trim();
    if (!name) {
      setError("Job name is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: { jobId?: number; id?: number } }>(
        "/api/v1/mobile/pursuits",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "manual",
            initialStatus: "upcoming",
            jobName: name,
            jobNumber: jobNumber.trim() || undefined,
            bidDueDate: bidDueDate.trim() || undefined,
            region: user?.region ?? "Central",
            preconDepartment: user?.preconDepartment ?? "Central Precon",
            estimatePhase: "ROM",
            bidYear: new Date().getFullYear(),
          }),
        },
      );
      setCreateOpen(false);
      setJobName("");
      setJobNumber("");
      setBidDueDate("");
      const jid = res.data?.jobId ?? res.data?.id;
      if (jid) router.push(`/(app)/schedule/${jid}`);
      else load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sort === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setSortDir(key === "bidDueDate" ? "asc" : "asc");
    }
  };

  return (
    <Screen>
      <GlassHeader title="Bid Schedule" subtitle={`${rows.length} rounds`} />

      <Text
        variant="micro"
        style={{
          color: colors.steel,
          letterSpacing: 0.8,
          paddingHorizontal: spacing.lg,
          marginTop: spacing.sm,
          marginBottom: 4,
        }}
      >
        VIEW
      </Text>
      <ChipRow>
        <Chip
          label="Timeline"
          selected={viewMode === "timeline"}
          onPress={() => setViewMode("timeline")}
          accessibilityLabel="Timeline by due date"
        />
        <Chip
          label="List"
          selected={viewMode === "list"}
          onPress={() => setViewMode("list")}
          accessibilityLabel="List with filters"
        />
      </ChipRow>

      <Text
        variant="micro"
        style={{
          color: colors.steel,
          letterSpacing: 0.8,
          paddingHorizontal: spacing.lg,
          marginTop: spacing.sm,
          marginBottom: 4,
        }}
      >
        SECTION
      </Text>
      <ChipRow>
        {SECTIONS.map((s) => {
          const count =
            s.key === "all"
              ? (sectionCounts.active ?? 0) +
                (sectionCounts.upcoming ?? 0) +
                (sectionCounts.outstanding ?? 0)
              : sectionCounts[s.key];
          const label =
            count != null && count > 0 ? `${s.label} · ${count}` : s.label;
          return (
            <Chip
              key={s.key}
              label={label}
              selected={section === s.key}
              onPress={() => setSection(s.key)}
              accessibilityLabel={`Section ${s.label}`}
            />
          );
        })}
      </ChipRow>

      {viewMode === "list" ? (
        <>
          <Text
            variant="micro"
            style={{
              color: colors.steel,
              letterSpacing: 0.8,
              paddingHorizontal: spacing.lg,
              marginTop: spacing.sm,
              marginBottom: 4,
            }}
          >
            GROUP BY
          </Text>
          <ChipRow>
            {GROUPS.map((g) => (
              <Chip
                key={g.key}
                label={g.label}
                selected={groupBy === g.key}
                onPress={() => setGroupBy(g.key)}
                accessibilityLabel={`Group by ${g.label}`}
              />
            ))}
          </ChipRow>

          <Text
            variant="micro"
            style={{
              color: colors.steel,
              letterSpacing: 0.8,
              paddingHorizontal: spacing.lg,
              marginTop: spacing.sm,
              marginBottom: 4,
            }}
          >
            SORT · {sortDir === "asc" ? "A→Z / soonest" : "Z→A / latest"}
          </Text>
          <ChipRow>
            {SORTS.map((s) => (
              <Chip
                key={s.key}
                label={sort === s.key ? `${s.label} ${sortDir === "asc" ? "↑" : "↓"}` : s.label}
                selected={sort === s.key}
                onPress={() => toggleSort(s.key)}
                accessibilityLabel={`Sort by ${s.label}`}
              />
            ))}
          </ChipRow>
        </>
      ) : (
        <Text
          muted
          variant="caption"
          style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}
        >
          Pursuits banded by bid due date · Overdue first
        </Text>
      )}

      {canCreate ? (
        <View style={{ paddingHorizontal: spacing.lg, marginVertical: spacing.sm }}>
          <Button title="New pursuit" onPress={() => setCreateOpen(true)} />
        </View>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : error && !rows.length ? (
        <ErrorState message={error} />
      ) : listItems.length === 0 ? (
        <EmptyState message="No rounds in this section" />
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          stickyHeaderIndices={listItems
            .map((item, i) => (item.type === "header" ? i : -1))
            .filter((i) => i >= 0)}
          renderItem={({ item }) => {
            if (item.type === "header") {
              const bandKey = item.key.startsWith("band:")
                ? (item.key.slice(5) as DueBand)
                : null;
              const accent = bandKey ? BAND_ACCENT[bandKey] : colors.foreground;
              return (
                <View
                  style={[
                    styles.groupHeader,
                    { backgroundColor: colors.background, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.bandDot, { backgroundColor: accent }]} />
                  <Text variant="callout" style={{ color: colors.foreground, flex: 1 }}>
                    {item.title}
                  </Text>
                  <Text muted variant="caption">
                    {item.count} {item.count === 1 ? "round" : "rounds"}
                  </Text>
                </View>
              );
            }
            const row = item.row;
            return (
              <Pressable
                onPress={() => router.push(`/(app)/schedule/${row.jobId}`)}
                accessibilityRole="button"
                accessibilityLabel={row.jobName}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <GlassCard>
                  <View style={styles.rowTop}>
                    <Text
                      variant="callout"
                      numberOfLines={2}
                      style={{ flex: 1, color: colors.foreground }}
                    >
                      {row.jobName}
                    </Text>
                    <StatusBadge status={row.status} />
                  </View>
                  <Text muted>
                    {row.jobNumber}
                    {row.estimatePhase ? ` · ${row.estimatePhase}` : ""}
                  </Text>
                  <View style={styles.dueRow}>
                    <Text
                      variant="caption"
                      style={{
                        color: colors.foreground,
                        fontFamily: "Manrope_600SemiBold",
                      }}
                    >
                      {formatDue(row.bidDueDate)}
                    </Text>
                    {row.preconDepartment ? (
                      <Text muted variant="caption">
                        · {row.preconDepartment}
                      </Text>
                    ) : null}
                  </View>
                </GlassCard>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <GlassView intensity={50} style={styles.modalCard}>
            <Text variant="headline" style={{ color: colors.foreground, marginBottom: spacing.md }}>
              New pursuit
            </Text>
            <Text muted variant="caption" style={{ marginBottom: 4 }}>
              Job name *
            </Text>
            <TextInput
              value={jobName}
              onChangeText={setJobName}
              placeholder="Project name"
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
            <Text muted variant="caption" style={{ marginBottom: 4, marginTop: spacing.sm }}>
              Job number (optional)
            </Text>
            <TextInput
              value={jobNumber}
              onChangeText={setJobNumber}
              placeholder="TBD or Salesforce #"
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
            <Text muted variant="caption" style={{ marginBottom: 4, marginTop: spacing.sm }}>
              Bid due date (YYYY-MM-DD)
            </Text>
            <TextInput
              value={bidDueDate}
              onChangeText={setBidDueDate}
              placeholder="2026-09-15"
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
            {error ? (
              <Text style={{ color: colors.destructive, marginTop: spacing.sm }}>{error}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setCreateOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={creating ? "Creating…" : "Create"}
                onPress={createPursuit}
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
  rowTop: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 4 },
  dueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  bandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
