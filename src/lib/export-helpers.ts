import ExcelJS from "exceljs";
import { PRODUCT_NAME } from "@/lib/product";
import { loadNotApplicableKeysByRound } from "@/services/field-exceptions-service";
import {
  listCustomColumnsForPrincipal,
  listRoundsWithJobsForPrincipal,
} from "./authorization/loaders";
import type { Principal } from "./authorization/types";
import { LATEST_NOTE_KEY } from "./latest-note";
import { latestNoteCellsForRounds } from "./latest-note-query";
import { METRIC_DEFS } from "./metrics";
import { getCustomValuesForRounds, getMultiValuesForRounds } from "./queries";
import {
  buildFieldCatalog,
  type FlatRow,
  flattenRound,
  type ReportFieldDef,
} from "./report-engine";

export type ExportColumn = { key: string; label: string; type: string };

/** Flattened cross-dataset rows + the introspected field catalog (incl. custom columns). */
export async function getFlatDataset(principal: Principal): Promise<{
  rows: FlatRow[];
  catalog: ReportFieldDef[];
}> {
  const [rowData, customCols] = await Promise.all([
    listRoundsWithJobsForPrincipal(principal),
    listCustomColumnsForPrincipal(principal),
  ]);
  const ids = rowData.map((r) => r.round.id);
  const [multiMap, customMap, noteMap, naMap] = await Promise.all([
    getMultiValuesForRounds(ids),
    getCustomValuesForRounds(ids),
    latestNoteCellsForRounds(ids),
    loadNotApplicableKeysByRound(ids),
  ]);
  const rows = rowData.map((r) =>
    flattenRound(
      r.round,
      r.job,
      r.estimateLeadName,
      multiMap.get(r.round.id) ?? {},
      customMap.get(r.round.id) ?? {},
      noteMap.get(r.round.id) ?? null,
      naMap.get(r.round.id)
    )
  );
  return { rows, catalog: buildFieldCatalog(customCols) };
}

function excelFormat(type: string, key: string): string | undefined {
  if (type === "dollars") return '"$"#,##0';
  if (type === "number") return "#,##0.0";
  if (type === "percent") return "0.0%";
  if (type === "metric") {
    const m = METRIC_DEFS.find((x) => `metric:${x.key}` === key);
    if (m?.format === "percent") return "0.0%";
    if (m?.format === "dollars") return '"$"#,##0';
    return "0.00";
  }
  return undefined;
}

export async function buildWorkbook(opts: {
  title: string;
  sheetName?: string;
  columns: ExportColumn[];
  rows: FlatRow[];
  groupBy?: string[];
  footer?: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = PRODUCT_NAME;
  const ws = wb.addWorksheet(opts.sheetName ?? "Export", {
    pageSetup: { orientation: "landscape", fitToPage: true },
    headerFooter: {
      oddHeader: `&L&B${opts.title}&R${new Date().toLocaleDateString("en-US")}`,
      oddFooter: `&L${opts.footer ?? ""}&RPage &P of &N`,
    },
  });

  // Title row
  ws.mergeCells(1, 1, 1, Math.max(2, opts.columns.length));
  const titleCell = ws.getCell(1, 1);
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1E3A5F" } };
  ws.getRow(1).height = 24;

  // Header row
  const headerRow = ws.addRow(opts.columns.map((c) => c.label));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A5F" },
    };
    cell.border = { bottom: { style: "thin" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  const groupBy = opts.groupBy ?? [];
  const writeDataRow = (r: FlatRow) => {
    const row = ws.addRow(
      opts.columns.map((c) => {
        const v = r[c.key];
        return v == null || v === "" ? null : v;
      })
    );
    opts.columns.forEach((c, i) => {
      const fmt = excelFormat(c.type, c.key);
      const cell = row.getCell(i + 1);
      if (fmt) cell.numFmt = fmt;
      cell.font = { size: 10 };
      cell.alignment = { wrapText: true, vertical: "top" };
    });
    const note = r[LATEST_NOTE_KEY];
    if (typeof note === "string" && note.length > 80) {
      row.height = Math.min(90, 18 + Math.ceil(note.length / 80) * 14);
    }
  };

  if (groupBy.length > 0) {
    const groups = new Map<string, FlatRow[]>();
    for (const r of opts.rows) {
      const key = groupBy.map((g) => String(r[g] ?? "—")).join(" / ");
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }
    for (const [groupName, groupRows] of [...groups.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      const gr = ws.addRow([`${groupName}  (${groupRows.length})`]);
      ws.mergeCells(gr.number, 1, gr.number, Math.max(2, opts.columns.length));
      gr.getCell(1).font = { bold: true, size: 10 };
      gr.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8EEF4" },
      };
      groupRows.forEach(writeDataRow);
    }
  } else {
    opts.rows.forEach(writeDataRow);
  }

  // Column widths from content. Latest-note stays at the wrap-friendly cap.
  opts.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.key === LATEST_NOTE_KEY) {
      col.width = 42;
      return;
    }
    const maxLen = Math.max(
      c.label.length,
      ...opts.rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length)
    );
    col.width = Math.min(42, Math.max(10, maxLen + 2));
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Print-ready HTML used as the PDF export path (browser print → Save as PDF). */
export function buildPrintHtml(opts: {
  title: string;
  columns: ExportColumn[];
  rows: FlatRow[];
  formatValue: (key: string, value: string | number | null) => string;
  groupBy?: string[];
  footer?: string;
}): string {
  const groupBy = opts.groupBy ?? [];
  let bodyRows = "";

  const rowHtml = (r: FlatRow) =>
    `<tr>${opts.columns
      .map((c) => {
        const numeric = ["dollars", "number", "metric"].includes(c.type);
        const note = c.key === LATEST_NOTE_KEY;
        const cls = [numeric ? "num" : "", note ? "note" : ""]
          .filter(Boolean)
          .join(" ");
        return `<td${cls ? ` class="${cls}"` : ""}>${esc(opts.formatValue(c.key, r[c.key] ?? null))}</td>`;
      })
      .join("")}</tr>`;

  if (groupBy.length > 0) {
    const groups = new Map<string, FlatRow[]>();
    for (const r of opts.rows) {
      const key = groupBy.map((g) => String(r[g] ?? "—")).join(" / ");
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }
    for (const [name, rows] of [...groups.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      bodyRows += `<tr class="group"><td colspan="${opts.columns.length}">${esc(name)} (${rows.length})</td></tr>`;
      bodyRows += rows.map(rowHtml).join("");
    }
  } else {
    bodyRows = opts.rows.map(rowHtml).join("");
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(opts.title)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { max-width: 100%; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; margin: 32px; color: #1a202c; overflow-x: hidden; }
  h1 { font-size: 18px; margin: 0 0 2px; color: #1e3a5f; }
  .meta { font-size: 11px; color: #64748b; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5px; table-layout: fixed; }
  thead { display: table-header-group; }
  tbody { display: table-row-group; }
  th, td {
    text-align: left;
    padding: 6px 8px;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
    max-width: 12rem;
  }
  th { background: #1e3a5f; color: white; font-weight: 600; }
  td { border-bottom: 1px solid #e2e8f0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  th.note, td.note { max-width: 22rem; width: 28%; }
  tr, tr.group { break-inside: avoid; page-break-inside: avoid; }
  tr.group td { background: #e8eef4; font-weight: 700; }
  .footer { margin-top: 18px; font-size: 10px; color: #94a3b8; }
  .toolbar { position: fixed; top: 12px; right: 12px; }
  .toolbar button { padding: 8px 16px; background: #1e3a5f; color: white; border: 0; border-radius: 6px; cursor: pointer; font-size: 13px; }
  @media print { .toolbar { display: none; } body { margin: 0; overflow-x: hidden; } }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  <h1>${esc(opts.title)}</h1>
  <p class="meta">Generated ${new Date().toLocaleString("en-US")} · ${opts.rows.length} record${opts.rows.length === 1 ? "" : "s"} · B&amp;G Precon — Pursuits &amp; Data</p>
  <table>
    <thead><tr>${opts.columns.map((c) => `<th${c.key === LATEST_NOTE_KEY ? ' class="note"' : ""}>${esc(c.label)}</th>`).join("")}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p class="footer">${esc(opts.footer ?? "Brasfield & Gorrie Preconstruction — Confidential")}</p>
</body>
</html>`;
}
