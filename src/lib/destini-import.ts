/**
 * Destini post-bid ingest — map markup-aligned labels → round field keys.
 *
 * Destini-sourced fields only (markup Destini column = "x"). Job Number /
 * Estimate Phase are match keys; Job Name is display-only.
 */

import ExcelJS from "exceljs";
import { FIELD_MAP } from "@/lib/fields";

/** Round column keys Destini is allowed to write. */
export const DESTINI_WRITABLE_KEYS = [
  "estimateValue",
  "feeBackPage",
  "craftLaborBase",
  "craftLaborBurden",
  "craftLaborManHours",
  "gcBgSort",
  "gcProposedOwnerSov",
  "grProposedOwnerSov",
  "pmMonths",
  "fieldSupervisionMonths",
  "preconCost",
  "designCost",
  "projectScheduleDuration",
  "gsf",
  "hotelKeysUnits",
  "afmMonths",
  "peakManpowerHeadcount",
] as const;

export type DestiniWritableKey = (typeof DESTINI_WRITABLE_KEYS)[number];

export function destiniChecksumIsApplied(
  batches: { source: string; checksum: string; status: string }[],
  checksum: string
): boolean {
  return batches.some(
    (batch) =>
      batch.source === "destini" &&
      batch.checksum === checksum &&
      batch.status === "applied"
  );
}

export type DestiniMappedRow = {
  jobNumber: string | null;
  jobName: string | null;
  estimatePhase: string | null;
  values: Partial<Record<DestiniWritableKey, number | string | null>>;
  unmappedHeaders: string[];
  skippedEmpty: string[];
};

/** Normalized label → semantic key (match keys + writable + display). */
const LABEL_MAP: Record<string, string> = {
  "job number": "jobNumber",
  jobnumber: "jobNumber",
  "job name": "jobName",
  "estimate phase": "estimatePhase",
  phase: "estimatePhase",

  // Keys are post-normLabel (no $, en-dash → hyphen, collapsed spaces).
  "estimate value": "estimateValue",
  "grand total": "estimateValue",
  "grand total price": "estimateValue",

  "fee back page": "feeBackPage",
  "fee - back page": "feeBackPage",
  "project fee": "feeBackPage",

  "craft labor base": "craftLaborBase",
  "craft labor burden": "craftLaborBurden",
  "craft labor man hours": "craftLaborManHours",
  "craft labor manhours": "craftLaborManHours",

  "gc b&g sort": "gcBgSort",
  "gc - b&g sort": "gcBgSort",
  "gc bg sort": "gcBgSort",
  "general conditions": "gcBgSort",

  "gc proposed owner sov": "gcProposedOwnerSov",
  "gc proposed - owner sov": "gcProposedOwnerSov",

  "gr proposed owner sov": "grProposedOwnerSov",
  "gr proposed - owner sov": "grProposedOwnerSov",

  "pm months": "pmMonths",
  "pm months apm to pd": "pmMonths",
  "field supervision months": "fieldSupervisionMonths",
  "field supervision months afm to gs": "fieldSupervisionMonths",
  "super months": "fieldSupervisionMonths",

  "precon cost included in estimate": "preconCost",
  "precon cost in estimate": "preconCost",
  "precon cost": "preconCost",

  "design cost included in estimate": "designCost",
  "design cost in estimate": "designCost",
  "design cost": "designCost",

  "project schedule duration mo": "projectScheduleDuration",
  "project schedule duration": "projectScheduleDuration",
  "schedule duration": "projectScheduleDuration",

  gsf: "gsf",
  "hotel keys / apartment units / beds": "hotelKeysUnits",
  "hotel keys apartment units beds": "hotelKeysUnits",
  "afm months": "afmMonths",
  "peak manpower headcount": "peakManpowerHeadcount",
};

const WRITABLE = new Set<string>(DESTINI_WRITABLE_KEYS);

export function normLabel(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\$/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9&/\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCell(v: unknown): string | number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as {
      result?: unknown;
      text?: string;
      richText?: { text: string }[];
    };
    if (o.result != null) return parseCell(o.result);
    if (o.richText) return parseCell(o.richText.map((t) => t.text).join(""));
    if (o.text) return parseCell(o.text);
  }
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[$,]/g, ""));
  if (
    !Number.isNaN(n) &&
    /[\d.]/.test(s) &&
    !/[a-zA-Z]/.test(s.replace(/[eE]/g, ""))
  ) {
    return n;
  }
  return s;
}

function resolveKey(label: string): string | null {
  const n = normLabel(label);
  if (!n) return null;
  if (LABEL_MAP[n]) return LABEL_MAP[n]!;
  // Soft fallback: strip trailing words like "dollars"
  const stripped = n.replace(/\s+\$?\s*$/, "").trim();
  return LABEL_MAP[stripped] ?? null;
}

function applyMapping(
  pairs: { label: string; value: unknown }[]
): DestiniMappedRow {
  const values: DestiniMappedRow["values"] = {};
  const unmappedHeaders: string[] = [];
  const skippedEmpty: string[] = [];
  let jobNumber: string | null = null;
  let jobName: string | null = null;
  let estimatePhase: string | null = null;

  for (const { label, value } of pairs) {
    if (!label.trim()) continue;
    const key = resolveKey(label);
    const parsed = parseCell(value);

    if (!key) {
      // Section headers / non-Destini fields — ignore quietly if empty
      if (parsed != null) unmappedHeaders.push(label);
      continue;
    }

    if (key === "jobNumber") {
      jobNumber = parsed == null ? null : String(parsed);
      continue;
    }
    if (key === "jobName") {
      jobName = parsed == null ? null : String(parsed);
      continue;
    }
    if (key === "estimatePhase") {
      estimatePhase = parsed == null ? null : String(parsed);
      continue;
    }

    if (!WRITABLE.has(key)) continue;

    if (parsed == null) {
      skippedEmpty.push(label);
      continue;
    }
    values[key as DestiniWritableKey] = parsed;
  }

  return {
    jobNumber,
    jobName,
    estimatePhase,
    values,
    unmappedHeaders,
    skippedEmpty,
  };
}

/** Map a header row + data row (tabular CSV / multi-job sheet). */
export function mapDestiniRow(
  headers: string[],
  cells: unknown[]
): DestiniMappedRow {
  return applyMapping(headers.map((label, i) => ({ label, value: cells[i] })));
}

export function mapDestiniSheet(
  headers: string[],
  rows: unknown[][]
): DestiniMappedRow[] {
  return rows
    .filter((r) => r.some((c) => c != null && String(c).trim() !== ""))
    .map((r) => mapDestiniRow(headers, r));
}

/**
 * Vertical Destini report: Data Point | Input columns (one estimate per file).
 * Finds the header row containing both labels, then reads pairs below.
 */
export function parseDestiniVerticalSheet(rows: unknown[][]): DestiniMappedRow {
  let headerIdx = -1;
  let labelCol = 0;
  let inputCol = 1;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cells = row.map((c) => normLabel(String(c ?? "")));
    const di = cells.findIndex(
      (c) => c === "data point" || c === "data points"
    );
    const ii = cells.findIndex(
      (c) => c === "input" || c === "value" || c === "response"
    );
    if (di >= 0 && ii >= 0) {
      headerIdx = r;
      labelCol = di;
      inputCol = ii;
      break;
    }
  }

  if (headerIdx < 0) {
    // Fallback: treat col 0 / col 1 as label/value from first non-empty row
    const pairs = rows
      .map((row) => ({
        label: String(row?.[0] ?? ""),
        value: row?.[1],
      }))
      .filter((p) => p.label.trim());
    return applyMapping(pairs);
  }

  const pairs: { label: string; value: unknown }[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const label = String(row[labelCol] ?? "").trim();
    if (!label) continue;
    pairs.push({ label, value: row[inputCol] });
  }
  return applyMapping(pairs);
}

export type DestiniDetectResult =
  | { format: "vertical"; sheetName: string; rows: unknown[][] }
  | {
      format: "tabular";
      sheetName: string;
      headers: string[];
      rows: unknown[][];
    };

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as {
      result?: unknown;
      text?: string;
      richText?: { text: string }[];
    };
    if (o.result != null) return cellText(o.result);
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if (o.text) return o.text;
  }
  return String(v);
}

function sheetToMatrix(ws: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const arr: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      arr[col - 1] = cell.value;
    });
    // exceljs sparse — ensure length
    while (arr.length < (row.cellCount || 0)) arr.push(null);
    rows[rowNumber - 1] = arr;
  });
  // compact undefined holes between rows
  return rows.map((r) => r ?? []);
}

function looksVertical(matrix: unknown[][]): boolean {
  for (const row of matrix.slice(0, 20)) {
    const cells = (row ?? []).map((c) => normLabel(cellText(c)));
    if (cells.includes("data point") || cells.includes("data points")) {
      return true;
    }
  }
  return false;
}

/** Detect format from an in-memory workbook matrix set. */
export function detectDestiniFormat(
  sheets: { name: string; rows: unknown[][] }[]
): DestiniDetectResult {
  const preferred =
    sheets.find((s) => /report/i.test(s.name)) ??
    sheets.find((s) => looksVertical(s.rows)) ??
    sheets[0];

  if (!preferred) {
    return { format: "tabular", sheetName: "", headers: [], rows: [] };
  }

  if (looksVertical(preferred.rows) || /report/i.test(preferred.name)) {
    return {
      format: "vertical",
      sheetName: preferred.name,
      rows: preferred.rows,
    };
  }

  // Tabular: first non-empty row = headers
  const headerRow =
    preferred.rows.find((r) => (r ?? []).some((c) => cellText(c).trim())) ?? [];
  const headers = headerRow.map((c) => cellText(c).trim());
  const dataRows = preferred.rows
    .slice(preferred.rows.indexOf(headerRow) + 1)
    .filter((r) => (r ?? []).some((c) => cellText(c).trim()));
  return {
    format: "tabular",
    sheetName: preferred.name,
    headers,
    rows: dataRows,
  };
}

export type DestiniParseFileResult = {
  format: "vertical" | "tabular";
  sheetName: string;
  rows: DestiniMappedRow[];
};

/** Parse an .xlsx buffer (server-side). */
export async function parseDestiniWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<DestiniParseFileResult> {
  const wb = new ExcelJS.Workbook();
  // exceljs typings accept Buffer in practice; cast keeps us off their Buffer brand.
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheets = wb.worksheets.map((ws) => ({
    name: ws.name,
    rows: sheetToMatrix(ws),
  }));
  const detected = detectDestiniFormat(sheets);

  if (detected.format === "vertical") {
    return {
      format: "vertical",
      sheetName: detected.sheetName,
      rows: [parseDestiniVerticalSheet(detected.rows)],
    };
  }

  return {
    format: "tabular",
    sheetName: detected.sheetName,
    rows: mapDestiniSheet(detected.headers, detected.rows),
  };
}

/** Parse CSV text into mapped rows. */
export function parseDestiniCsv(text: string): DestiniParseFileResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  if (lines.length === 0) {
    return { format: "tabular", sheetName: "csv", rows: [] };
  }

  const matrix = lines.map(parseLine);
  if (looksVertical(matrix)) {
    return {
      format: "vertical",
      sheetName: "csv",
      rows: [parseDestiniVerticalSheet(matrix)],
    };
  }

  const headers = matrix[0] ?? [];
  const data = matrix.slice(1);
  return {
    format: "tabular",
    sheetName: "csv",
    rows: mapDestiniSheet(headers, data),
  };
}

export function filterWritableValues(
  values: Record<string, number | string | null | undefined>
): Partial<Record<DestiniWritableKey, number | string | null>> {
  const out: Partial<Record<DestiniWritableKey, number | string | null>> = {};
  for (const key of DESTINI_WRITABLE_KEYS) {
    if (key in values && values[key] !== undefined) {
      out[key] = values[key] as number | string | null;
    }
  }
  return out;
}

export function buildDestiniFieldDiffs(
  current: Partial<Record<DestiniWritableKey, number | string | null>>,
  incoming: Partial<Record<DestiniWritableKey, number | string | null>>
): {
  key: DestiniWritableKey;
  label: string;
  current: number | string | null;
  incoming: number | string | null;
  changed: boolean;
}[] {
  return DESTINI_WRITABLE_KEYS.filter((key) => key in incoming).map((key) => {
    const from = current[key] ?? null;
    const to = incoming[key] ?? null;
    return {
      key,
      label: FIELD_MAP[key]?.label ?? key,
      current: from,
      incoming: to,
      changed: String(from ?? "") !== String(to ?? ""),
    };
  });
}
