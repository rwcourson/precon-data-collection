/**
 * Pure formatters for mobile data surfaces.
 * Keep in sync with src/lib/mobile-data-display.ts and iOS SheetDisplay.
 */

export function formatCompactDollars(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

export function formatKpiValue(
  value: number | null | undefined,
  format: string,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (format === "dollars") return formatCompactDollars(value);
  if (format === "percent") {
    // Win rate may arrive as 0–1 ratio or already 0–100
    const pct = value > 0 && value <= 1 ? value * 100 : value;
    return `${pct.toFixed(1)}%`;
  }
  if (format === "number") return Math.round(value).toLocaleString("en-US");
  return String(Math.round(value * 100) / 100);
}

/** Empty cells show em dash for Smartsheet-like scanning. */
export function cellDisplay(value: string | null | undefined): string {
  if (value == null) return "—";
  const t = String(value).trim();
  return t.length ? t : "—";
}

/** Heuristic column width from header label (for mobile horizontal grid). */
export function sheetColumnWidth(
  label: string,
  opts?: { min?: number; max?: number },
): number {
  const min = opts?.min ?? 96;
  const max = opts?.max ?? 200;
  const base = 28 + (label?.length ?? 4) * 8;
  return Math.min(max, Math.max(min, base));
}

export type DueBand = "overdue" | "this_week" | "next_week" | "later" | "none";

export const DUE_BAND_ORDER: DueBand[] = [
  "overdue",
  "this_week",
  "next_week",
  "later",
  "none",
];

export const DUE_BAND_LABELS: Record<DueBand, string> = {
  overdue: "Overdue",
  this_week: "This week",
  next_week: "Next week",
  later: "Later",
  none: "No due date",
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDueDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return startOfDay(d);
}

/**
 * Bucket a bid due date relative to `now` for Smartsheet-style timeline bands.
 */
export function dueDateBand(
  iso: string | null | undefined,
  now: Date = new Date(),
): DueBand {
  const due = parseDueDate(iso);
  if (!due) return "none";
  const today = startOfDay(now);
  const msDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((due.getTime() - today.getTime()) / msDay);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "this_week";
  if (diffDays <= 14) return "next_week";
  return "later";
}

export function dueBandLabel(band: DueBand): string {
  return DUE_BAND_LABELS[band];
}

export function formatDueDateHuman(iso: string | null | undefined): string {
  const due = parseDueDate(iso);
  if (!due) return "No due date";
  return due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type DueBandGroup<T> = {
  band: DueBand;
  label: string;
  rows: T[];
};

/** Group rows by due-date band; empty bands omitted; order fixed. */
export function groupRowsByDueBand<T extends { bidDueDate: string | null }>(
  rows: T[],
  now: Date = new Date(),
): DueBandGroup<T>[] {
  const map = new Map<DueBand, T[]>();
  for (const band of DUE_BAND_ORDER) map.set(band, []);
  for (const row of rows) {
    const band = dueDateBand(row.bidDueDate, now);
    map.get(band)!.push(row);
  }
  // Within each band: soonest first; nulls last inside "none"
  for (const band of DUE_BAND_ORDER) {
    const list = map.get(band)!;
    list.sort((a, b) => {
      const da = parseDueDate(a.bidDueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = parseDueDate(b.bidDueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }
  return DUE_BAND_ORDER.filter((b) => (map.get(b)?.length ?? 0) > 0).map((band) => ({
    band,
    label: dueBandLabel(band),
    rows: map.get(band)!,
  }));
}

export type SheetColumnLike = { key: string; label: string };
export type SheetRowLike = {
  id: number;
  values: Record<string, string | null>;
};

/**
 * True multi-column layout contract: every body row has exactly headers.length cells.
 * Used by SheetGrid and tests to catch misaligned stacks.
 */
export function assertGridAligned(matrix: {
  headers: string[];
  body: { cells: string[] }[];
}): boolean {
  const n = matrix.headers.length;
  if (n < 1) return false;
  return matrix.body.every((r) => r.cells.length === n);
}

/** Build header + cell matrix for sheet grid from live columns/rows. */
export function buildSheetGridMatrix(
  columns: SheetColumnLike[],
  rows: SheetRowLike[],
): {
  headers: string[];
  keys: string[];
  widths: number[];
  body: { rowId: number; cells: string[] }[];
} {
  const keys = columns.map((c) => c.key);
  const headers = columns.map((c) => c.label);
  const widths = columns.map((c) => sheetColumnWidth(c.label));
  const body = rows.map((r) => ({
    rowId: r.id,
    cells: keys.map((k) => cellDisplay(r.values?.[k])),
  }));
  return { headers, keys, widths, body };
}

// ---------------------------------------------------------------------------
// Sheet list presentation — human labels, rank sort, folder groups
// ---------------------------------------------------------------------------

/**
 * Parse expo-router / query flags used when opening a sheet detail
 * (`?pinned=1&canManage=true`). Empty/unknown → false.
 */
export function parseRouteFlag(
  value: string | string[] | null | undefined,
): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return false;
  const t = String(raw).trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

/** Detail Archive toolbar — same gate as list swipe and web SheetCard. */
export function canShowSheetArchive(canManage: boolean | null | undefined): boolean {
  return canManage === true;
}

/**
 * Known keys (seed / import often ships `pcn_*` or snake_case names).
 * Keep in sync with apps/ios Formatters.sheetDisplayName.
 */
const SHEET_LABELS: Record<string, string> = {
  pcn_bid_schedule: "Bid Schedule",
  bid_schedule: "Bid Schedule",
  pcn_post_bid: "Post Bid",
  post_bid: "Post Bid",
  pcn_project_forecast: "Project Forecast",
  project_forecast: "Project Forecast",
  pcn_historical_projects: "Historical Projects",
  historical_projects: "Historical Projects",
  pcn_annual_stats: "Annual Stats",
  annual_stats: "Annual Stats",
  pcn_contacts: "Contacts",
  contacts: "Contacts",
  pcn_labor_rates: "Labor Rates",
  labor_rates: "Labor Rates",
  pcn_labor_rate_history: "Labor Rate History",
  labor_rate_history: "Labor Rate History",
  pcn_equipment_rates: "Equipment Rates",
  equipment_rates: "Equipment Rates",
  pcn_equipment_rate_history: "Equipment Rate History",
  equipment_rate_history: "Equipment Rate History",
  pcn_unit_prices: "Unit Prices",
  unit_prices: "Unit Prices",
  pcn_unit_price_history: "Unit Price History",
  unit_price_history: "Unit Price History",
  pcn_gmp_history: "GMP History",
  gmp_history: "GMP History",
  pcn_sub_rates: "Subcontractor Rates",
  sub_rates: "Subcontractor Rates",
  pcn_sub_rate_history: "Subcontractor Rate History",
  sub_rate_history: "Subcontractor Rate History",
};

/** Lower rank = higher in list (core B&G workflow first). */
const SHEET_SORT_RANK: Record<string, number> = {
  pcn_bid_schedule: 10,
  bid_schedule: 10,
  pcn_post_bid: 20,
  post_bid: 20,
  pcn_project_forecast: 30,
  project_forecast: 30,
  pcn_historical_projects: 40,
  historical_projects: 40,
  pcn_annual_stats: 50,
  annual_stats: 50,
  pcn_contacts: 60,
  contacts: 60,
  pcn_labor_rates: 70,
  labor_rates: 70,
  pcn_labor_rate_history: 71,
  labor_rate_history: 71,
  pcn_equipment_rates: 80,
  equipment_rates: 80,
  pcn_equipment_rate_history: 81,
  equipment_rate_history: 81,
  pcn_unit_prices: 90,
  unit_prices: 90,
  pcn_unit_price_history: 91,
  unit_price_history: 91,
  pcn_gmp_history: 100,
  gmp_history: 100,
  pcn_sub_rates: 110,
  sub_rates: 110,
  pcn_sub_rate_history: 111,
  sub_rate_history: 111,
};

const SHEET_ACRONYMS = new Set(["GMP", "RPD", "CBG", "BG", "ID", "AL", "FL", "GA", "TX", "CEN", "CAR"]);

function normalizeSheetKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Human title for a sheet — never show raw `pcn_bid_schedule` in the UI. */
export function sheetDisplayName(name: string | null | undefined): string {
  const raw = String(name ?? "").trim();
  if (!raw) return "Untitled sheet";

  const key = normalizeSheetKey(raw);
  if (SHEET_LABELS[key]) return SHEET_LABELS[key];

  const strippedKey = key.replace(/^pcn_/, "");
  if (SHEET_LABELS[strippedKey]) return SHEET_LABELS[strippedKey];
  if (SHEET_LABELS[`pcn_${strippedKey}`]) return SHEET_LABELS[`pcn_${strippedKey}`];

  // Already a human title (spaces, mixed case) — strip accidental pcn_ only.
  if (/\s/.test(raw) && /[A-Z]/.test(raw)) {
    return raw.replace(/^pcn[_\s]+/i, "").trim() || raw;
  }

  let s = raw.replace(/^pcn_/i, "");
  if (/[_-]/.test(s) || s === s.toLowerCase()) {
    return s
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((w) => {
        const upper = w.toUpperCase();
        if (SHEET_ACRONYMS.has(upper)) return upper;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  }
  return s;
}

export function sheetFolderLabel(folder: string | null | undefined): string {
  const t = String(folder ?? "").trim();
  if (!t || t === "—") return "General";
  return t;
}

export function sheetKindLabel(kind: string | null | undefined): string {
  return kind === "view" ? "View" : "Grid";
}

export function sheetSortRank(name: string | null | undefined): number {
  const key = normalizeSheetKey(String(name ?? ""));
  if (SHEET_SORT_RANK[key] != null) return SHEET_SORT_RANK[key];
  const stripped = key.replace(/^pcn_/, "");
  if (SHEET_SORT_RANK[stripped] != null) return SHEET_SORT_RANK[stripped];
  if (SHEET_SORT_RANK[`pcn_${stripped}`] != null) return SHEET_SORT_RANK[`pcn_${stripped}`];
  return 1000;
}

export function sheetListSubtitle(s: {
  folder?: string | null;
  kind?: string | null;
  rowCount?: number | null;
  pinned?: boolean | null;
}): string {
  const parts = [
    sheetFolderLabel(s.folder),
    sheetKindLabel(s.kind),
    `${(s.rowCount ?? 0).toLocaleString("en-US")} rows`,
  ];
  if (s.pinned) parts.push("Pinned");
  return parts.join(" · ");
}

export type SheetListLike = {
  id: number;
  name: string;
  folder?: string | null;
  kind?: string | null;
  pinned?: boolean | null;
  rowCount?: number | null;
  description?: string | null;
};

/** Pinned first → workflow rank → folder → display name. */
export function sortSheetsForList<T extends SheetListLike>(sheets: T[]): T[] {
  return [...sheets].sort((a, b) => {
    const pinA = a.pinned ? 0 : 1;
    const pinB = b.pinned ? 0 : 1;
    if (pinA !== pinB) return pinA - pinB;
    const rankA = sheetSortRank(a.name);
    const rankB = sheetSortRank(b.name);
    if (rankA !== rankB) return rankA - rankB;
    const fa = sheetFolderLabel(a.folder).localeCompare(sheetFolderLabel(b.folder));
    if (fa !== 0) return fa;
    return sheetDisplayName(a.name).localeCompare(sheetDisplayName(b.name));
  });
}

export type SheetFolderGroup<T> = { folder: string; sheets: T[] };

/** Group sorted sheets by folder for sectioned lists. */
export function groupSheetsByFolder<T extends SheetListLike>(
  sheets: T[],
): SheetFolderGroup<T>[] {
  const sorted = sortSheetsForList(sheets);
  const map = new Map<string, T[]>();
  const order: string[] = [];
  for (const s of sorted) {
    const f = sheetFolderLabel(s.folder);
    if (!map.has(f)) {
      map.set(f, []);
      order.push(f);
    }
    map.get(f)!.push(s);
  }
  return order.map((folder) => ({ folder, sheets: map.get(folder)! }));
}

/** Case-insensitive filter on display name, raw name, folder, description. */
export function filterSheetsByQuery<T extends SheetListLike>(
  sheets: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return sheets;
  return sheets.filter((s) => {
    const hay = [
      sheetDisplayName(s.name),
      s.name,
      sheetFolderLabel(s.folder),
      s.description ?? "",
      sheetKindLabel(s.kind),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
