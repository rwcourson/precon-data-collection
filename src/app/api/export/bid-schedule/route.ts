import type { NextRequest } from "next/server";
import type { ExportTemplateConfig } from "@/db/schema";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { applyBidScheduleExportScope } from "@/lib/bid-schedule";
import {
  buildPrintHtml,
  buildWorkbook,
  type ExportColumn,
  getFlatDataset,
} from "@/lib/export-helpers";
import { pdfResponse } from "@/lib/pdf";
import { formatReportValue } from "@/lib/report-engine";
import { resolveRegionParam } from "@/lib/workspace";
import { getWorkspace } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";
// Synchronous xlsx/PDF build; PDF uses headless Chromium.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "xlsx";

  let config: ExportTemplateConfig;
  try {
    config = JSON.parse(params.get("config") ?? "{}");
  } catch {
    return new Response("Invalid export config", { status: 400 });
  }
  if (!config.columns || config.columns.length === 0) {
    return new Response("No columns selected", { status: 400 });
  }

  const [principal, workspace] = await Promise.all([
    getWebPrincipal(),
    getWorkspace(),
  ]);
  const scoped = resolveRegionParam(workspace, params.get("region"));
  if ("error" in scoped) return new Response(scoped.error, { status: 403 });

  const { rows, catalog } = await getFlatDataset(principal);

  const filtered = applyBidScheduleExportScope(rows, {
    section: params.get("section"),
    region: scoped.region,
    regions: params.get("regions"),
    departments: params.get("departments"),
    phase: params.get("phase"),
    year: params.get("year"),
    q: params.get("q"),
    sortBy: config.sortBy,
  });

  const columns: ExportColumn[] = config.columns.map((key) => {
    const def = catalog.find((c) => c.key === key);
    return { key, label: def?.label ?? key, type: def?.type ?? "text" };
  });

  const title = config.header || "Bid Schedule";
  const footer =
    config.footer || "Brasfield & Gorrie Preconstruction — Confidential";

  if (format === "pdf") {
    const html = buildPrintHtml({
      title,
      columns,
      rows: filtered,
      groupBy: config.groupBy,
      footer,
      formatValue: (key, value) => formatReportValue(key, value, catalog),
    });
    return pdfResponse(html, title, { footer });
  }

  const buffer = await buildWorkbook({
    title,
    sheetName: "Bid Schedule",
    columns,
    rows: filtered,
    groupBy: config.groupBy,
    footer,
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bid-schedule-${Date.now()}.xlsx"`,
    },
  });
}
