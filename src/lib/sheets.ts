import type {
  Sheet,
  SheetColumnType,
  SheetViewConfig,
  User,
} from "@/db/schema";
import type { FlatRow, ReportFieldDef } from "./report-engine";

/**
 * Sheet model shared by client and server.
 *
 * The Smartsheet workspace B&G is replacing is a folder tree of sheets that
 * Regions create for themselves. Parity means three things: the tree, the
 * ability to make a new sheet without IT, and a grid that behaves like a grid.
 * The difference — and the reason this replaces rather than reimplements
 * Smartsheet — is that a pursuit sheet is a *view* of one record set, so the
 * same project cannot disagree with itself across two sheets.
 */

export const DEFAULT_VIEW_COLUMNS = [
  "jobNumber",
  "jobName",
  "estimatePhase",
  "bidYear",
  "bidDueDate",
  "estimateLead",
  "estimateValue",
  "status",
];

export const BLANK_VIEW_CONFIG: SheetViewConfig = {
  columns: DEFAULT_VIEW_COLUMNS,
  filters: [],
  sortBy: [{ field: "bidDueDate", dir: "asc" }],
  groupBy: [],
};

export const FILTER_OPS = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "in", label: "is any of" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "notblank", label: "is not blank" },
  { value: "blank", label: "is blank" },
] as const;

export const SHEET_COLUMN_TYPES: { value: SheetColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "dollars", label: "Dollars" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "contact", label: "Contact" },
];

/** Rename/move/delete a sheet, and change its columns or saved view. */
export function canManageSheet(
  user: User,
  sheet: Pick<Sheet, "region" | "ownerId">
): boolean {
  if (user.role === "corporate_admin") return true;
  if (sheet.ownerId === user.id) return true;
  if (
    user.role === "rpd" &&
    sheet.region != null &&
    sheet.region === user.region
  )
    return true;
  // A Corporate sheet is governed centrally, never by a single Region.
  return false;
}

/** Create sheets in a workspace. Leadership reads; everyone else builds. */
export function canCreateSheet(user: User, region: string | null): boolean {
  if (user.role === "leadership") return false;
  if (user.role === "corporate_admin") return true;
  if (region == null) return false;
  return user.region == null || user.region === region;
}

/** Type cell values in a `grid` sheet, or fields in a pursuit view. */
export function canEditRows(user: User): boolean {
  return user.role !== "leadership";
}

// ---- View evaluation -------------------------------------------------------

export type SheetGroup = {
  key: string;
  label: string;
  rows: FlatRow[];
  /** Sums for numeric columns, so a grouped sheet reads like a subtotalled one. */
  totals: Record<string, number>;
};

export type SheetViewResult = {
  columns: { key: string; label: string; type: string }[];
  rows: FlatRow[];
  groups: SheetGroup[] | null;
  /** Rows before filtering, for the "N of M" count. */
  total: number;
};

function compare(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/** Stable labeled buckets — shared by Sheets views and the live Bid Schedule. */
export type LabeledGroup<T> = {
  key: string;
  label: string;
  rows: T[];
};

/**
 * Groups already-sorted rows while preserving within-group order.
 * Blank / null keys become "(blank)"; buckets sort by label.
 */
export function groupRowsByField<T>(
  rows: T[],
  getKey: (row: T) => string | number | null | undefined
): LabeledGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const raw = getKey(r);
    const key = raw == null || raw === "" ? "—" : String(raw);
    const bucket = map.get(key);
    if (bucket) bucket.push(r);
    else map.set(key, [r]);
  }

  return [...map.entries()]
    .map(([key, groupRows]) => ({
      key,
      label: key === "—" || key === "" ? "(blank)" : key,
      rows: groupRows,
    }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true })
    );
}

export function matchesFilter(
  row: FlatRow,
  f: { field: string; op: string; value: string }
): boolean {
  const raw = row[f.field];
  const text = String(raw ?? "").toLowerCase();
  const needle = f.value.trim().toLowerCase();
  switch (f.op) {
    case "eq":
      return text === needle;
    case "neq":
      return text !== needle;
    case "in":
      return needle
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .includes(text);
    case "contains":
      return text.includes(needle);
    case "gt":
      return raw != null && Number(raw) > Number(f.value);
    case "lt":
      return raw != null && Number(raw) < Number(f.value);
    case "blank":
      return raw == null || raw === "";
    case "notblank":
      return raw != null && raw !== "";
    default:
      return true;
  }
}

/**
 * Applies a saved view to the live dataset. Unlike the report builder, grouping
 * keeps every row and adds subtotal headers — a sheet stays a sheet.
 */
export function evaluateView(
  allRows: FlatRow[],
  config: SheetViewConfig,
  catalog: ReportFieldDef[]
): SheetViewResult {
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  const columns = config.columns
    .filter((key) => byKey.has(key))
    .map((key) => {
      const def = byKey.get(key)!;
      return { key, label: def.label, type: def.type as string };
    });

  let rows = allRows;
  for (const f of config.filters)
    rows = rows.filter((r) => matchesFilter(r, f));

  const sorted = [...rows].sort((a, b) => {
    for (const s of config.sortBy) {
      const c = compare(a[s.field] ?? null, b[s.field] ?? null);
      if (c !== 0) return s.dir === "asc" ? c : -c;
    }
    return 0;
  });

  const groupField = config.groupBy[0];
  if (!groupField) {
    return { columns, rows: sorted, groups: null, total: allRows.length };
  }

  const numericKeys = columns
    .filter((c) => ["number", "dollars", "metric"].includes(c.type))
    .map((c) => c.key);

  const groups: SheetGroup[] = groupRowsByField(
    sorted,
    (r) => r[groupField]
  ).map((g) => ({
    ...g,
    totals: Object.fromEntries(
      numericKeys.map((k) => [
        k,
        g.rows.reduce((sum, r) => {
          const v = r[k];
          return typeof v === "number" && Number.isFinite(v) ? sum + v : sum;
        }, 0),
      ])
    ),
  }));

  return { columns, rows: sorted, groups, total: allRows.length };
}

// ---- Folder tree -----------------------------------------------------------

export type FolderNode = {
  name: string;
  sheets: SheetSummary[];
};

export type SheetSummary = {
  id: number;
  kind: Sheet["kind"];
  name: string;
  description: string | null;
  region: string | null;
  folder: string;
  sourceSheet: string | null;
  ownerName: string | null;
  updatedAt: string;
  pinned: boolean;
  /** Live row count: matching records for a view, stored rows for a grid. */
  rowCount: number;
  /** Rename, move, archive. Offering these to people who cannot use them
   * turns a governance rule into a failed click, so the UI reads this. */
  canManage: boolean;
};

export function groupIntoFolders(sheets: SheetSummary[]): FolderNode[] {
  const map = new Map<string, SheetSummary[]>();
  for (const s of sheets) {
    const bucket = map.get(s.folder);
    if (bucket) bucket.push(s);
    else map.set(s.folder, [s]);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      sheets: list.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Slug used for grid column keys, stable enough to key stored cell values. */
export function columnKeyFromLabel(
  label: string,
  taken: string[] = []
): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "column";
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

/** "Copy of X", "Copy of X (2)" — matches what people expect from duplicate. */
export function duplicateName(name: string, existing: string[]): string {
  const base = `Copy of ${name}`;
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}
