import { NextRequest } from "next/server";
import type { SavedReportConfig } from "@/db/schema";
import {
  buildPrintHtml,
  buildWorkbook,
  getFlatDataset,
  type ExportColumn,
} from "@/lib/export-helpers";
import { formatReportValue, runReportEngine } from "@/lib/report-engine";
import { pdfResponse } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "xlsx";
  const name = params.get("name") || "Custom Report";

  let config: SavedReportConfig;
  try {
    config = JSON.parse(params.get("config") ?? "{}");
  } catch {
    return new Response("Invalid report config", { status: 400 });
  }
  if (!config.fields || config.fields.length === 0) {
    return new Response("No fields selected", { status: 400 });
  }

  const { rows, catalog } = await getFlatDataset();
  const result = runReportEngine(rows, config, catalog);

  const columns: ExportColumn[] = result.columns.map((c) => {
    const baseKey =
      c.key.includes(":") && !c.key.startsWith("metric:") && !c.key.startsWith("custom:")
        ? c.key.split(":")[1]
        : c.key;
    const def = catalog.find((x) => x.key === baseKey);
    const type = c.key.startsWith("count:") ? "number" : (def?.type ?? "text");
    return { key: c.key, label: c.label, type };
  });

  if (format === "pdf") {
    const html = buildPrintHtml({
      title: name,
      columns,
      rows: result.rows,
      formatValue: (key, value) => formatReportValue(key, value, catalog),
    });
    return pdfResponse(html, name);
  }

  const buffer = await buildWorkbook({
    title: name,
    sheetName: "Report",
    columns,
    rows: result.rows,
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name.replace(/[^a-z0-9-_ ]/gi, "")}.xlsx"`,
    },
  });
}
