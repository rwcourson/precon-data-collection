import ExcelJS from "exceljs";
import {
  getAllCustomColumns,
  getCustomValuesForRounds,
  getMultiValuesForRounds,
  getRoundsWithJobs,
} from "./queries";
import {
  buildFieldCatalog,
  flattenRound,
  type FlatRow,
  type ReportFieldDef,
} from "./report-engine";
import { METRIC_DEFS } from "./metrics";
import { getWorkspace } from "./workspace-server";

export type ExportColumn = { key: string; label: string; type: string };

/** Flattened cross-dataset rows + the introspected field catalog (incl. custom columns). */
export async function getFlatDataset(): Promise<{
  rows: FlatRow[];
  catalog: ReportFieldDef[];
}> {
  const workspace = await getWorkspace();
  const [rowData, customCols] = await Promise.all([
    getRoundsWithJobs(workspace),
    getAllCustomColumns(),
  ]);
  const ids = rowData.map((r) => r.round.id);
  const [multiMap, customMap] = await Promise.all([
    getMultiValuesForRounds(ids),
    getCustomValuesForRounds(ids),
  ]);
  const rows = rowData.map((r) =>
    flattenRound(
      r.round,
      r.job,
      r.estimateLeadName,
      multiMap.get(r.round.id) ?? {},
      customMap.get(r.round.id) ?? {},
    ),
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
  wb.creator = "B&G Precon Data Collection";
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
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.border = { bottom: { style: "thin" } };
    cell.alignment = { vertical: "middle" };
  });

  const groupBy = opts.groupBy ?? [];
  const writeDataRow = (r: FlatRow) => {
    const row = ws.addRow(
      opts.columns.map((c) => {
        const v = r[c.key];
        return v == null || v === "" ? null : v;
      }),
    );
    opts.columns.forEach((c, i) => {
      const fmt = excelFormat(c.type, c.key);
      if (fmt) row.getCell(i + 1).numFmt = fmt;
      row.getCell(i + 1).font = { size: 10 };
    });
  };

  if (groupBy.length > 0) {
    const groups = new Map<string, FlatRow[]>();
    for (const r of opts.rows) {
      const key = groupBy.map((g) => String(r[g] ?? "—")).join(" / ");
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }
    for (const [groupName, groupRows] of [...groups.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
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

  // Column widths from content
  opts.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    const maxLen = Math.max(
      c.label.length,
      ...opts.rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length),
    );
    col.width = Math.min(42, Math.max(10, maxLen + 2));
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
        return `<td class="${numeric ? "num" : ""}">${esc(opts.formatValue(c.key, r[c.key] ?? null))}</td>`;
      })
      .join("")}</tr>`;

  if (groupBy.length > 0) {
    const groups = new Map<string, FlatRow[]>();
    for (const r of opts.rows) {
      const key = groupBy.map((g) => String(r[g] ?? "—")).join(" / ");
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }
    for (const [name, rows] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
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
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; margin: 32px; color: #1a202c; }
  h1 { font-size: 18px; margin: 0 0 2px; color: #1e3a5f; }
  .meta { font-size: 11px; color: #64748b; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5px; }
  th { background: #1e3a5f; color: white; text-align: left; padding: 6px 8px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.group td { background: #e8eef4; font-weight: 700; }
  .footer { margin-top: 18px; font-size: 10px; color: #94a3b8; }
  .toolbar { position: fixed; top: 12px; right: 12px; }
  .toolbar button { padding: 8px 16px; background: #1e3a5f; color: white; border: 0; border-radius: 6px; cursor: pointer; font-size: 13px; }
  @media print { .toolbar { display: none; } body { margin: 0; } }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  <h1>${esc(opts.title)}</h1>
  <p class="meta">Generated ${new Date().toLocaleString("en-US")} · ${opts.rows.length} record${opts.rows.length === 1 ? "" : "s"} · B&amp;G Precon Data Collection</p>
  <table>
    <thead><tr>${opts.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p class="footer">${esc(opts.footer ?? "Brasfield & Gorrie Preconstruction — Confidential")}</p>
</body>
</html>`;
}
