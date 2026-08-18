import type { CustomColumn, EstimateRound, Job, SavedReportConfig } from "@/db/schema";
import { FIELD_DEFS, type FieldType } from "./fields";
import { LATEST_NOTE_KEY, LATEST_NOTE_LABEL } from "./latest-note";
import { METRIC_DEFS } from "./metrics";
import { STATUS_LABELS } from "./permissions";

/**
 * Report engine backing the Custom Report Builder (BRD Section 14).
 * Operates on a flattened cross-dataset row (Bid Schedule + post-bid +
 * calculated metrics + Region-specific custom columns) joined by round.
 */

export type FlatRow = Record<string, string | number | null>;

export type ReportFieldDef = {
  key: string;
  label: string;
  type: FieldType | "metric";
  /** Picker grouping; calculated metrics use "Metrics — <family>". */
  category: string;
};

export function buildFieldCatalog(customCols: CustomColumn[]): ReportFieldDef[] {
  const catalog: ReportFieldDef[] = [];
  for (const f of FIELD_DEFS) {
    catalog.push({
      key: f.key,
      label: f.label,
      type: f.type,
      category: f.core ? "Bid Schedule / Identity" : "Post-Bid Data",
    });
  }
  catalog.push(
    { key: "status", label: "Lifecycle Status", type: "dropdown", category: "Lifecycle" },
    { key: "outcome", label: "Outcome", type: "dropdown", category: "Lifecycle" },
    { key: "roundNumber", label: "Round #", type: "number", category: "Lifecycle" },
    { key: LATEST_NOTE_KEY, label: LATEST_NOTE_LABEL, type: "text", category: "Notes" },
  );
  for (const m of METRIC_DEFS) {
    catalog.push({
      key: `metric:${m.key}`,
      label: m.label,
      type: "metric",
      category: `Metrics — ${m.group}`,
    });
  }
  for (const c of customCols) {
    catalog.push({
      key: `custom:${c.id}`,
      label: `${c.label} (${c.region ?? "company"})`,
      type: c.type,
      category: "Custom Columns",
    });
  }
  return catalog;
}

export function flattenRound(
  round: EstimateRound,
  job: Job,
  estimateLeadName: string | null,
  multi: Record<string, string[]>,
  customValues: Record<number, string | null>,
  latestNote: string | null = null,
): FlatRow {
  const row: FlatRow = {
    id: round.id,
    jobNumber: job.jobNumber,
    jobName: job.jobName,
    estimateLead: estimateLeadName,
    status: STATUS_LABELS[round.status],
    outcome: round.outcome,
    roundNumber: round.roundNumber,
    [LATEST_NOTE_KEY]: latestNote,
  };
  for (const f of FIELD_DEFS) {
    if (f.key in row) continue;
    if (f.type === "multi") {
      row[f.key] = (multi[f.key] ?? []).join(", ") || null;
    } else {
      const v = (round as unknown as Record<string, unknown>)[f.key];
      row[f.key] = (v as string | number | null) ?? null;
    }
  }
  for (const m of METRIC_DEFS) {
    row[`metric:${m.key}`] = m.calc(round);
  }
  for (const [colId, v] of Object.entries(customValues)) {
    row[`custom:${colId}`] = v ?? null;
  }
  return row;
}

function compare(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function applyFilter(row: FlatRow, f: { field: string; op: string; value: string }): boolean {
  const v = row[f.field];
  switch (f.op) {
    case "eq":
      return String(v ?? "").toLowerCase() === f.value.toLowerCase();
    case "neq":
      return String(v ?? "").toLowerCase() !== f.value.toLowerCase();
    case "contains":
      return String(v ?? "").toLowerCase().includes(f.value.toLowerCase());
    case "gt":
      return v != null && Number(v) > Number(f.value);
    case "lt":
      return v != null && Number(v) < Number(f.value);
    case "notblank":
      return v != null && v !== "";
    default:
      return true;
  }
}

export type ReportResult = {
  columns: { key: string; label: string }[];
  rows: FlatRow[];
  isGrouped: boolean;
};

export function runReportEngine(
  flatRows: FlatRow[],
  config: SavedReportConfig,
  catalog: ReportFieldDef[],
): ReportResult {
  const labelOf = (key: string) => catalog.find((c) => c.key === key)?.label ?? key;

  let rows = flatRows;
  for (const f of config.filters) rows = rows.filter((r) => applyFilter(r, f));

  if (config.groupBy.length === 0) {
    const cols = config.fields.map((f) => ({ key: f, label: labelOf(f) }));
    const sorted = [...rows].sort((a, b) => {
      for (const s of config.sortBy) {
        const c = compare(a[s.field], b[s.field]);
        if (c !== 0) return s.dir === "asc" ? c : -c;
      }
      return 0;
    });
    return { columns: cols, rows: sorted, isGrouped: false };
  }

  // Grouped: group key columns + aggregation columns
  const groups = new Map<string, FlatRow[]>();
  for (const r of rows) {
    const key = config.groupBy.map((g) => String(r[g] ?? "—")).join("␟");
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const aggCols = config.aggregations.map((a) => ({
    key: `${a.fn}:${a.field}`,
    label:
      a.fn === "count"
        ? "Count"
        : `${a.fn.toUpperCase()} of ${labelOf(a.field)}`,
  }));
  const columns = [
    ...config.groupBy.map((g) => ({ key: g, label: labelOf(g) })),
    ...aggCols,
  ];

  const out: FlatRow[] = [];
  for (const [key, groupRows] of groups) {
    const parts = key.split("␟");
    const row: FlatRow = {};
    config.groupBy.forEach((g, i) => (row[g] = parts[i]));
    for (const a of config.aggregations) {
      const nums = groupRows
        .map((r) => r[a.field])
        .filter((v): v is number => typeof v === "number" && isFinite(v));
      switch (a.fn) {
        case "count":
          row[`count:${a.field}`] = groupRows.length;
          break;
        case "sum":
          row[`sum:${a.field}`] = nums.reduce((s, n) => s + n, 0);
          break;
        case "avg":
          row[`avg:${a.field}`] = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
          break;
        case "min":
          row[`min:${a.field}`] = nums.length ? Math.min(...nums) : null;
          break;
        case "max":
          row[`max:${a.field}`] = nums.length ? Math.max(...nums) : null;
          break;
      }
    }
    out.push(row);
  }

  const sorted = out.sort((a, b) => {
    for (const s of config.sortBy) {
      // Sort may reference either a group key or an aggregation output
      const av = a[s.field] ?? a[`sum:${s.field}`] ?? a[`avg:${s.field}`];
      const bv = b[s.field] ?? b[`sum:${s.field}`] ?? b[`avg:${s.field}`];
      const c = compare(av ?? null, bv ?? null);
      if (c !== 0) return s.dir === "asc" ? c : -c;
    }
    return 0;
  });

  return { columns, rows: sorted, isGrouped: true };
}

/** Formats a report cell based on the field definition it references. */
export function formatReportValue(
  key: string,
  value: string | number | null,
  catalog: ReportFieldDef[],
): string {
  if (key === LATEST_NOTE_KEY && (value == null || value === "")) return "";
  if (value == null || value === "") return "—";
  const baseKey = key.includes(":") && !key.startsWith("metric:") && !key.startsWith("custom:")
    ? key.split(":")[1]
    : key;
  const def = catalog.find((c) => c.key === baseKey);
  const isCount = key.startsWith("count:");
  if (isCount) return String(value);
  if (typeof value === "number") {
    if (def?.type === "dollars")
      return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    if (def?.type === "metric") {
      const metricKey = baseKey.replace("metric:", "");
      const m = METRIC_DEFS.find((x) => x.key === metricKey);
      if (m?.format === "percent") return `${(value * 100).toFixed(1)}%`;
      if (m?.format === "dollars")
        return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
      return value.toFixed(2);
    }
    return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return String(value);
}
