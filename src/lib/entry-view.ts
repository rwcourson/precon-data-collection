import type { CustomColumn } from "@/db/schema";
import {
  FIELD_GROUPS,
  type FieldDef,
  fieldsForRoundEntry,
  ROUND_COLUMN_KEYS,
} from "@/lib/fields";

export type EntryViewMode = "form" | "sheet";

export const ALL_ENTRY_SECTION = "all";
export const COMPANY_COLUMNS_SECTION = "Optional company columns";

const READ_ONLY_KEYS = new Set(["jobNumber", "jobName", "estimateLead"]);
const PINNED_SHEET_KEYS = ["jobName", "jobNumber"] as const;

export function parseEntryViewMode(
  raw: string | string[] | undefined
): EntryViewMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "sheet" ? "sheet" : "form";
}

/** Form is the default, so the URL stays clean unless Sheet is selected. */
export function entryViewHref(
  pathname: string,
  current: Record<string, string | undefined>,
  mode: EntryViewMode
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (!value || key === "viewMode") continue;
    params.set(key, value);
  }
  if (mode === "sheet") params.set("viewMode", "sheet");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function sheetColumnWidth(type: string, label: string): number {
  const base = Math.min(260, Math.max(90, label.length * 8 + 34));
  if (type === "dollars" || type === "metric" || type === "number") {
    return Math.max(base, 110);
  }
  if (type === "date") return 112;
  return base;
}

export type EntrySheetColumn = {
  key: string;
  label: string;
  type: string;
  width: number;
  editable: boolean;
  options?: string[];
  group?: string;
};

function customSheetColumn(
  column: Pick<CustomColumn, "id" | "label" | "type" | "options">,
  group = COMPANY_COLUMNS_SECTION
): EntrySheetColumn {
  return {
    key: `custom:${column.id}`,
    label: column.label,
    type: column.type,
    width: sheetColumnWidth(column.type, column.label),
    editable: true,
    options: column.options ?? undefined,
    group,
  };
}

export function isSheetEditableKey(key: string, type: string): boolean {
  if (key.startsWith("custom:")) return true;
  if (READ_ONLY_KEYS.has(key) || type === "multi") return false;
  return ROUND_COLUMN_KEYS.includes(key);
}

export function columnsForRoundEntry(input: {
  mode: "schedule" | "postBid";
  hideIjvDropdown?: boolean;
  lists: Record<string, string[]>;
  customCols?: Pick<CustomColumn, "id" | "label" | "type" | "options">[];
}): EntrySheetColumn[] {
  const fields = fieldsForRoundEntry({
    mode: input.mode,
    hideIjvDropdown: input.hideIjvDropdown,
  });
  const columns = fields.map((field) => fieldSheetColumn(field, input.lists));
  if (input.mode === "postBid") {
    for (const column of input.customCols ?? []) {
      columns.push(customSheetColumn(column));
    }
  }
  return columns;
}

export function columnsForCustomEntry(
  customCols: Pick<CustomColumn, "id" | "label" | "type" | "options">[]
): EntrySheetColumn[] {
  return customCols.map((column) => customSheetColumn(column));
}

function fieldSheetColumn(
  field: FieldDef,
  lists: Record<string, string[]>
): EntrySheetColumn {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    width: sheetColumnWidth(field.type, field.label),
    editable: isSheetEditableKey(field.key, field.type),
    options: field.listKey ? lists[field.listKey] : undefined,
    group: field.group,
  };
}

export function cellsForRoundEntry(input: {
  columns: { key: string }[];
  values: Record<string, string>;
  multi: Record<string, string[]>;
  custom: Record<number, string>;
  jobNumber: string;
  jobName: string;
  estimateLeadName?: string | null;
}): Record<string, string | number | null> {
  const cells: Record<string, string | number | null> = {};
  for (const column of input.columns) {
    if (column.key === "jobNumber") {
      cells[column.key] = input.jobNumber;
      continue;
    }
    if (column.key === "jobName") {
      cells[column.key] = input.jobName;
      continue;
    }
    if (column.key === "estimateLead") {
      cells[column.key] = input.estimateLeadName ?? null;
      continue;
    }
    if (column.key.startsWith("custom:")) {
      const columnId = Number(column.key.slice("custom:".length));
      cells[column.key] = input.custom[columnId] ?? null;
      continue;
    }
    if (column.key in input.multi) {
      const joined = (input.multi[column.key] ?? []).join(", ");
      cells[column.key] = joined || null;
      continue;
    }
    const value = input.values[column.key];
    cells[column.key] = value === "" || value == null ? null : value;
  }
  return cells;
}

export function cellsFromFlatRow(
  row: Record<string, string | number | null>,
  columns: { key: string }[]
): Record<string, string | number | null> {
  const cells: Record<string, string | number | null> = {};
  for (const column of columns) {
    cells[column.key] = row[column.key] ?? null;
  }
  return cells;
}

export function sectionSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseEntrySection(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value.trim() : ALL_ENTRY_SECTION;
}

export function entrySectionOptions(input: {
  mode: "schedule" | "postBid";
  hideIjvDropdown?: boolean;
  includeCompanyColumns?: boolean;
}): { value: string; label: string }[] {
  const fields = fieldsForRoundEntry({
    mode: input.mode,
    hideIjvDropdown: input.hideIjvDropdown,
  });
  const present = new Set(fields.map((field) => field.group));
  const labels = FIELD_GROUPS.filter((group) => present.has(group));
  if (input.includeCompanyColumns) labels.push(COMPANY_COLUMNS_SECTION);
  return [
    { value: ALL_ENTRY_SECTION, label: "All sections" },
    ...labels.map((label) => ({ value: sectionSlug(label), label })),
  ];
}

export function matchesEntrySection(
  group: string | undefined,
  section: string
): boolean {
  if (!section || section === ALL_ENTRY_SECTION) return true;
  return group != null && sectionSlug(group) === section;
}

export function filterSheetColumnsBySection(
  columns: EntrySheetColumn[],
  section: string,
  pinIdentity = false
): EntrySheetColumn[] {
  if (!section || section === ALL_ENTRY_SECTION) return columns;
  const matched = columns.filter((column) =>
    matchesEntrySection(column.group, section)
  );
  if (matched.length === 0) return columns;
  if (!pinIdentity) return matched;
  const extra = PINNED_SHEET_KEYS.map((key) =>
    columns.find((column) => column.key === key)
  ).filter(
    (column): column is EntrySheetColumn =>
      column != null && !matched.some((item) => item.key === column.key)
  );
  return [...extra, ...matched];
}
