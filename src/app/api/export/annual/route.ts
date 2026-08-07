import { NextRequest } from "next/server";
import { buildAnnualReport, renderAnnualReportHtml } from "@/lib/annual-report";
import { buildWorkbook, type ExportColumn } from "@/lib/export-helpers";
import { pdfResponse, safeName } from "@/lib/pdf";
import { getRoundsWithJobs } from "@/lib/queries";
import type { FlatRow } from "@/lib/report-engine";
import type { RollupStats } from "@/lib/rollup";
import { resolveRegionParam } from "@/lib/workspace";
import { getWorkspace } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

const GROUP_COLUMNS = (label: string): ExportColumn[] => [
  { key: "group", label, type: "text" },
  { key: "rounds", label: "Rounds", type: "number" },
  { key: "volume", label: "Pursuit Volume $", type: "dollars" },
  { key: "wonVolume", label: "Won Volume $", type: "dollars" },
  { key: "winRate", label: "Win Rate", type: "percent" },
  { key: "weightedFeePct", label: "Fee %", type: "percent" },
  { key: "weightedContingencyPct", label: "Contingency %", type: "percent" },
  { key: "feePerPmMonth", label: "Fee per PM Month", type: "dollars" },
];

const toGroupRow = (g: RollupStats): FlatRow => ({
  group: g.key,
  rounds: g.rounds,
  volume: g.volume,
  wonVolume: g.wonVolume,
  winRate: g.winRate,
  weightedFeePct: g.weightedFeePct,
  weightedContingencyPct: g.weightedContingencyPct,
  feePerPmMonth: g.feePerPmMonth,
});

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "pdf";
  const workspace = await getWorkspace();

  // A Region workspace pins the scope; Corporate may target any single Region.
  const scoped = resolveRegionParam(workspace, params.get("region"));
  if ("error" in scoped) return new Response(scoped.error, { status: 403 });
  const region = scoped.region;

  const currentYear = new Date().getFullYear();
  const toYear = clampYear(params.get("to"), currentYear);
  const fromYear = Math.min(clampYear(params.get("from"), toYear - 2), toYear);

  const rows = await getRoundsWithJobs(workspace);
  const report = buildAnnualReport({ rows, region, fromYear, toYear });
  const title = `${report.scope} Annual Precon Report ${fromYear}-${toYear}`;

  if (format === "xlsx") {
    // One sheet, three sections — the same story the PDF tells, grouped.
    const sheetRows: FlatRow[] = [
      ...report.years.map(({ year, stats }) => ({
        ...toGroupRow(stats),
        group: String(year),
        section: "1. Bid Year Trend",
      })),
      ...report.bySector.map((g) => ({
        ...toGroupRow(g),
        section: `2. ${report.focusYear} by Market Sector`,
      })),
      ...report.byDepartment.map((g) => ({
        ...toGroupRow(g),
        section: `3. ${report.focusYear} by Precon Department`,
      })),
    ];
    const buffer = await buildWorkbook({
      title,
      sheetName: "Annual Report",
      columns: GROUP_COLUMNS("Bid Year / Group"),
      rows: sheetRows,
      groupBy: ["section"],
      footer: "Brasfield & Gorrie Preconstruction — Confidential",
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName(title)}.xlsx"`,
      },
    });
  }

  const html = renderAnnualReportHtml(report);
  if (format === "html") {
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return pdfResponse(html, title, { landscape: false });
}

function clampYear(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) return fallback;
  return n;
}
