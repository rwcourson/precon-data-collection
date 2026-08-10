import { NextRequest } from "next/server";
import type { ExportTemplateConfig } from "@/db/schema";
import {
  buildPrintHtml,
  buildWorkbook,
  getFlatDataset,
  type ExportColumn,
} from "@/lib/export-helpers";
import { formatReportValue } from "@/lib/report-engine";
import { STATUS_LABELS } from "@/lib/permissions";
import { pdfResponse } from "@/lib/pdf";
import { resolveRegionParam } from "@/lib/workspace";
import { getWorkspace } from "@/lib/workspace-server";
import { getWebPrincipal } from "@/lib/authorization/web-principal";

export const dynamic = "force-dynamic";

const SECTION_STATUSES: Record<string, string[]> = {
  all: ["active", "upcoming", "outstanding"],
  active: ["active"],
  upcoming: ["upcoming"],
  outstanding: ["outstanding"],
};

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

  const [principal, workspace] = await Promise.all([getWebPrincipal(), getWorkspace()]);
  const scoped = resolveRegionParam(workspace, params.get("region"));
  if ("error" in scoped) return new Response(scoped.error, { status: 403 });

  const { rows, catalog } = await getFlatDataset(principal);

  // Apply the same filters as the Bid Schedule view
  const section = params.get("section") ?? "all";
  const statuses = (SECTION_STATUSES[section] ?? SECTION_STATUSES.all).map(
    (s) => STATUS_LABELS[s as keyof typeof STATUS_LABELS],
  );
  const region = scoped.region;
  const phase = params.get("phase");
  const year = params.get("year");
  const q = (params.get("q") ?? "").toLowerCase();

  let filtered = rows.filter((r) => statuses.includes(String(r.status)));
  if (region) filtered = filtered.filter((r) => r.region === region);
  if (phase && phase !== "all") filtered = filtered.filter((r) => r.estimatePhase === phase);
  if (year && year !== "all") filtered = filtered.filter((r) => String(r.bidYear) === year);
  if (q)
    filtered = filtered.filter(
      (r) =>
        String(r.jobName ?? "").toLowerCase().includes(q) ||
        String(r.jobNumber ?? "").toLowerCase().includes(q),
    );

  // Sorting
  for (const s of [...(config.sortBy ?? [])].reverse()) {
    filtered = [...filtered].sort((a, b) => {
      const av = a[s.field];
      const bv = b[s.field];
      const c =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""));
      return s.dir === "asc" ? c : -c;
    });
  }

  const columns: ExportColumn[] = config.columns.map((key) => {
    const def = catalog.find((c) => c.key === key);
    return { key, label: def?.label ?? key, type: def?.type ?? "text" };
  });

  const title = config.header || "Bid Schedule";
  const footer = config.footer || "Brasfield & Gorrie Preconstruction — Confidential";

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
