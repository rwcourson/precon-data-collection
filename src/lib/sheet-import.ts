import type { SheetColumnType } from "@/db/schema";
import { columnKeyFromLabel } from "./sheets";

/**
 * Turning a spreadsheet into a sheet.
 *
 * Most of the Smartsheet workspace that is *not* pursuit data got there by
 * someone importing a spreadsheet — rosters, monthly cost tracking, action
 * lists. A replacement that can only create blank grids asks those people to
 * retype years of work, so the same door has to exist here: drop the file in,
 * get a working sheet with typed columns.
 */

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_COLUMNS = 60;

/**
 * A table as read off a file: the first row is treated as the header when it
 * looks like labels rather than data.
 */
export type ImportTable = string[][];

export type ImportedColumn = {
  key: string;
  label: string;
  type: SheetColumnType;
  options: string[] | null;
  width: number;
};

export type ImportedSheet = {
  columns: ImportedColumn[];
  rows: Record<string, string | null>[];
  /** Rows dropped past the cap, so the UI can say so rather than lose them silently. */
  skippedRows: number;
};

/** Splits CSV/TSV text, honouring quoted fields that contain the delimiter. */
export function parseDelimited(text: string): ImportTable {
  const body = text.replace(/^\uFEFF/, "");
  const delimiter = guessDelimiter(body);
  const rows: ImportTable = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (quoted) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function guessDelimiter(text: string): string {
  const sample = text.slice(0, 4000);
  const tabs = (sample.match(/\t/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  const semicolons = (sample.match(/;/g) ?? []).length;
  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}([T ]|$)/,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
  /^[A-Z][a-z]{2} \d{1,2},? \d{4}$/,
];

const BOOLEAN_WORDS = new Set(["true", "false", "yes", "no", "y", "n", "x", "✓"]);

function numeric(value: string): boolean {
  const cleaned = value.replace(/[$,%\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  return cleaned !== "" && Number.isFinite(Number(cleaned));
}

/**
 * Type from the values, with the label breaking ties: "Amount" holding 1200 is
 * dollars, "Headcount" holding 1200 is a number.
 */
export function inferColumnType(label: string, values: (string | null)[]): SheetColumnType {
  const present = values.filter((v): v is string => v != null && v.trim() !== "");
  if (present.length === 0) return "text";

  if (present.every((v) => BOOLEAN_WORDS.has(v.trim().toLowerCase()))) return "checkbox";
  if (present.every((v) => DATE_PATTERNS.some((p) => p.test(v.trim())))) return "date";

  if (present.every(numeric)) {
    const currency = present.some((v) => v.includes("$"));
    return currency || /(\$|cost|value|amount|fee|revenue|price|budget|spend)/i.test(label)
      ? "dollars"
      : "number";
  }

  // A short, repeating vocabulary is a picklist in every spreadsheet that has one.
  const distinct = new Set(present.map((v) => v.trim()));
  if (distinct.size > 1 && distinct.size <= 12 && present.length >= distinct.size * 3)
    return "dropdown";

  return "text";
}

const TRUTHY = new Set(["true", "yes", "y", "x", "1", "✓"]);

/**
 * Rewrites an imported value into the form the grid stores, so a cell read from
 * a file behaves exactly like one typed in: "$12,500" becomes 12500, "8/5/2026"
 * becomes 2026-08-05, and a ticked box becomes "true" rather than "Yes".
 */
export function normalizeValue(type: SheetColumnType, raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;

  switch (type) {
    case "checkbox":
      return TRUTHY.has(value.toLowerCase()) ? "true" : null;
    case "number":
    case "dollars": {
      const cleaned = value.replace(/[$,%\s]/g, "").replace(/^\((.*)\)$/, "-$1");
      return Number.isFinite(Number(cleaned)) ? String(Number(cleaned)) : value;
    }
    case "date": {
      const iso = toIsoDate(value);
      return iso ?? value;
    }
    default:
      return value;
  }
}

function toIsoDate(value: string): string | null {
  const already = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (already) return already[1];
  const slashed = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashed) {
    const [, month, day, year] = slashed;
    const full = year.length === 2 ? `20${year}` : year;
    return `${full}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** True when the first row reads as labels rather than another data row. */
function looksLikeHeader(table: ImportTable): boolean {
  const [first, second] = table;
  if (!first) return false;
  const labelled = first.filter((c) => c.trim() !== "");
  if (labelled.length === 0) return false;
  if (first.some((c) => numeric(c) && c.trim() !== "")) return false;
  if (!second) return true;
  // A header is a header when the row under it is shaped differently.
  return second.some((c, i) => c.trim() !== "" && numeric(c) && !numeric(first[i] ?? ""));
}

function defaultWidth(type: SheetColumnType, label: string): number {
  if (type === "checkbox") return 90;
  if (type === "date") return 120;
  if (type === "number" || type === "dollars") return 130;
  return Math.min(320, Math.max(140, label.length * 9 + 40));
}

/**
 * Reads a raw table into columns and rows. Blank trailing columns are dropped,
 * unnamed ones are numbered, and duplicate labels get distinct keys so nothing
 * silently overwrites a neighbour.
 */
export function buildImportedSheet(table: ImportTable): ImportedSheet {
  if (table.length === 0) return { columns: [], rows: [], skippedRows: 0 };

  const hasHeader = looksLikeHeader(table);
  const header = hasHeader ? table[0] : [];
  const body = hasHeader ? table.slice(1) : table;

  const width = Math.min(
    IMPORT_MAX_COLUMNS,
    table.reduce((max, row) => Math.max(max, row.length), 0),
  );

  const labels: string[] = [];
  for (let i = 0; i < width; i++) {
    const raw = (header[i] ?? "").trim();
    labels.push(raw || `Column ${i + 1}`);
  }

  const skippedRows = Math.max(0, body.length - IMPORT_MAX_ROWS);
  const kept = body.slice(0, IMPORT_MAX_ROWS);
  const cells = labels.map((_, i) =>
    kept.map((row) => {
      const value = (row[i] ?? "").trim();
      return value === "" ? null : value;
    }),
  );

  const keys: string[] = [];
  const columns: ImportedColumn[] = labels.map((label, i) => {
    const key = columnKeyFromLabel(label, keys);
    keys.push(key);
    const type = inferColumnType(label, cells[i]);
    const options =
      type === "dropdown"
        ? [...new Set(cells[i].filter((v): v is string => v != null))].sort()
        : null;
    return { key, label, type, options, width: defaultWidth(type, label) };
  });

  const rows = kept
    .map((_, rowIndex) => {
      const values: Record<string, string | null> = {};
      columns.forEach((column, i) => {
        const raw = cells[i][rowIndex];
        if (raw == null) return;
        const value = normalizeValue(column.type, raw);
        if (value != null) values[column.key] = value;
      });
      return values;
    })
    .filter((values) => Object.keys(values).length > 0);

  return { columns, rows, skippedRows };
}
