import { NextRequest } from "next/server";
import type { SheetFilter } from "@/db/schema";
import {
  buildPrintHtml,
  buildWorkbook,
  getFlatDataset,
  type ExportColumn,
} from "@/lib/export-helpers";
import { formatReportValue, type FlatRow } from "@/lib/report-engine";
import { pdfResponse } from "@/lib/pdf";
import { formatCell } from "@/lib/sheet-format";
import { BLANK_VIEW_CONFIG, matchesFilter } from "@/lib/sheets";
import { getSheet, loadSheetGrid, visibleInWorkspace } from "@/lib/sheets-server";
import { getWorkspace } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

/** Excel and PDF for either kind of sheet, using whatever the viewer sees. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const id = Number(params.get("id"));
  if (!Number.isInteger(id)) return new Response("Missing sheet id", { status: 400 });

  const [sheet, workspace] = await Promise.all([getSheet(id), getWorkspace()]);
  if (!sheet || sheet.archivedAt) return new Response("Sheet not found", { status: 404 });
  if (!visibleInWorkspace(sheet, workspace))
    return new Response("That sheet belongs to another Region's workspace.", { status: 403 });

  const format = params.get("format") ?? "xlsx";
  const title = sheet.name;

  let columns: ExportColumn[];
  let rows: FlatRow[];
  let formatValue: (key: string, value: string | number | null) => string;

  if (sheet.kind === "grid") {
    const grid = await loadSheetGrid(sheet);
    columns = grid.columns.map((c) => ({ key: c.key, label: c.label, type: c.type }));
    rows = grid.rows.map((r) => {
      const row: FlatRow = {};
      for (const c of grid.columns) {
        const raw = r.values[c.key] ?? null;
        row[c.key] = raw != null && ["number", "dollars"].includes(c.type) ? Number(raw) : raw;
      }
      return row;
    });
    const typeByKey = new Map(grid.columns.map((c) => [c.key, c.type as string]));
    formatValue = (key, value) =>
      value == null || value === "" ? "" : formatCell(typeByKey.get(key) ?? "text", value);
  } else {
    const config = sheet.config ?? BLANK_VIEW_CONFIG;
    // The toolbar passes what is on screen, so an export matches the view even
    // before someone saves the layout.
    const columnKeys = params.get("columns")?.split(",").filter(Boolean) ?? config.columns;
    let filters: SheetFilter[] = config.filters;
    const raw = params.get("filters");
    if (raw) {
      try {
        filters = JSON.parse(raw) as SheetFilter[];
      } catch {
        return new Response("Invalid filters", { status: 400 });
      }
    }

    const dataset = await getFlatDataset();
    const byKey = new Map(dataset.catalog.map((c) => [c.key, c]));
    columns = columnKeys
      .filter((k) => byKey.has(k))
      .map((k) => ({ key: k, label: byKey.get(k)!.label, type: byKey.get(k)!.type }));
    rows = dataset.rows.filter((r) => filters.every((f) => matchesFilter(r, f)));
    formatValue = (key, value) => formatReportValue(key, value, dataset.catalog);
  }

  if (columns.length === 0) return new Response("This sheet has no columns", { status: 400 });

  if (format === "pdf") {
    const html = buildPrintHtml({ title, columns, rows, formatValue });
    return pdfResponse(html, title, {
      footer: `${sheet.region ?? "Corporate"} · ${sheet.folder} · Brasfield & Gorrie Preconstruction`,
    });
  }

  const buffer = await buildWorkbook({
    title,
    sheetName: title.slice(0, 28) || "Sheet",
    columns,
    rows,
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${title.replace(/[^a-z0-9-_ ]/gi, "")}.xlsx"`,
    },
  });
}
