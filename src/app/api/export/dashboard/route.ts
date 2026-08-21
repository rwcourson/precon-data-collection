import type { NextRequest } from "next/server";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  buildPrintHtml,
  buildWorkbook,
  type ExportColumn,
  formatExportCell,
} from "@/lib/export-helpers";
import { pdfResponse, safeName } from "@/lib/pdf";
import type { FlatRow } from "@/lib/report-engine";
import { rollup, scopeRoundsForDashboardExport } from "@/lib/rollup";
import { resolveRegionParam } from "@/lib/workspace";
import { getWorkspace } from "@/lib/workspace-server";
import { maskRoundRowsForMetrics } from "@/services/field-exceptions-service";

export const dynamic = "force-dynamic";
// Synchronous xlsx workbook build over the full scoped dataset.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const level = params.get("level") ?? "corporate";
  const region = params.get("region");
  const dept = params.get("dept");
  const year = params.get("year");

  const [principal, workspace] = await Promise.all([
    getWebPrincipal(),
    getWorkspace(),
  ]);
  const scoped = resolveRegionParam(
    workspace,
    level === "corporate" ? null : region
  );
  if ("error" in scoped) return new Response(scoped.error, { status: 403 });

  const listed = await listRoundsWithJobsForPrincipal(principal);
  const data = await maskRoundRowsForMetrics(listed);
  const rounds = scopeRoundsForDashboardExport(
    data.map((r) => r.round),
    {
      region: scoped.region,
      dept: level === "division" ? dept : null,
      year,
      sector: params.get("sector"),
      phase: params.get("phase"),
      status: params.get("status"),
      rounds: params.get("rounds"),
    }
  );

  const groupFn =
    level === "corporate"
      ? (r: (typeof rounds)[number]) => r.region
      : level === "region"
        ? (r: (typeof rounds)[number]) => r.preconDepartment
        : (r: (typeof rounds)[number]) => r.marketSector ?? "Unclassified";

  const groups = rollup(rounds, groupFn);
  const groupLabel =
    level === "corporate"
      ? "Region"
      : level === "region"
        ? "Division / Precon Dept"
        : "Market Sector";

  const columns: ExportColumn[] = [
    { key: "group", label: groupLabel, type: "text" },
    { key: "rounds", label: "Estimate Rounds", type: "number" },
    { key: "volume", label: "Pursuit Volume $", type: "dollars" },
    { key: "avgEstimateValue", label: "Avg Estimate Value $", type: "dollars" },
    { key: "winRate", label: "Win Rate (count)", type: "percent" },
    { key: "winRateByValue", label: "Win Rate (value)", type: "percent" },
    { key: "wonVolume", label: "Won Volume $", type: "dollars" },
    { key: "totalFee", label: "Expected Fee $", type: "dollars" },
    { key: "weightedFeePct", label: "Fee % (weighted)", type: "percent" },
    { key: "avgFeePct", label: "Fee % (avg of rounds)", type: "percent" },
    {
      key: "weightedContingencyPct",
      label: "Contingency % (weighted)",
      type: "percent",
    },
    { key: "weightedGcGrPct", label: "GC+GR % (weighted)", type: "percent" },
    { key: "feePerPmMonth", label: "Fee per PM Month", type: "dollars" },
    { key: "revenuePerPmYear", label: "Revenue per PM Year", type: "dollars" },
    { key: "totalPmMonths", label: "PM Months", type: "number" },
    {
      key: "totalSelfPerform",
      label: "Self-Perform $ Proposed",
      type: "dollars",
    },
    {
      key: "selfPerformCaptureRate",
      label: "Self-Perform Capture",
      type: "percent",
    },
    { key: "totalManHours", label: "Craft Labor Man Hours", type: "number" },
    {
      key: "laborCostPerManHour",
      label: "Craft Labor $ per Man Hour",
      type: "dollars",
    },
    { key: "costPerGsf", label: "Estimate $ per GSF", type: "dollars" },
  ];

  const rows: FlatRow[] = groups.map((g) => ({
    group: g.key,
    rounds: g.rounds,
    volume: g.volume,
    avgEstimateValue: g.avgEstimateValue,
    winRate: g.winRate,
    winRateByValue: g.winRateByValue,
    wonVolume: g.wonVolume,
    totalFee: g.totalFee,
    weightedFeePct: g.weightedFeePct,
    avgFeePct: g.avgFeePct,
    weightedContingencyPct: g.weightedContingencyPct,
    weightedGcGrPct: g.weightedGcGrPct,
    feePerPmMonth: g.feePerPmMonth,
    revenuePerPmYear: g.revenuePerPmYear,
    totalPmMonths: g.totalPmMonths,
    totalSelfPerform: g.totalSelfPerform,
    selfPerformCaptureRate: g.selfPerformCaptureRate,
    totalManHours: g.totalManHours,
    laborCostPerManHour: g.laborCostPerManHour,
    costPerGsf: g.costPerGsf,
  }));

  const scope =
    level === "corporate"
      ? "Corporate — All Regions"
      : level === "region"
        ? `${region} Region`
        : `${region} — ${dept === "all" ? "All Divisions" : dept}`;

  const title = `Estimate Summary Rollup — ${scope}${year && year !== "all" ? ` — Bid Year ${year}` : ""}`;
  const footer = "Brasfield & Gorrie Preconstruction — Confidential";

  if (params.get("format") === "pdf") {
    const html = buildPrintHtml({
      title,
      columns,
      rows,
      footer,
      formatValue: (key, value) => {
        const col = columns.find((c) => c.key === key);
        return formatExportCell(col?.type ?? "text", value);
      },
    });
    return pdfResponse(html, title, { footer, landscape: true });
  }

  const buffer = await buildWorkbook({
    title,
    sheetName: "Rollup",
    columns,
    rows,
    footer,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName(title)}.xlsx"`,
    },
  });
}
