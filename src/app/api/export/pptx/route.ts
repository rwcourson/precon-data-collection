import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { getWorkspace } from "@/lib/workspace-server";
import {
  buildForecastSeries,
  DEFAULT_FORECAST_ASSUMPTIONS,
} from "@/lib/forecast";

/** 16:9 dashboard / forecast slide export. */
export async function GET() {
  const [principal, workspace] = await Promise.all([getWebPrincipal(), getWorkspace()]);
  const rounds = await listRoundsWithJobsForPrincipal(principal);

  const series = buildForecastSeries(
    rounds.map((r) => ({
      id: r.round.id,
      jobId: r.job.id,
      jobNumber: r.job.jobNumber,
      jobName: r.job.jobName,
      estimateValue: r.round.estimateValue,
      timingDate: r.round.projectStartDate ?? r.round.bidDueDate,
      outcome: r.round.outcome,
      region: r.round.region,
    })),
    DEFAULT_FORECAST_ASSUMPTIONS,
  );

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";

  const title = pptx.addSlide();
  title.addText("Preconstruction Volume Projection", {
    x: 0.5,
    y: 2.5,
    w: 12,
    h: 1,
    fontSize: 32,
    bold: true,
    color: "1a1a1a",
  });
  title.addText(
    `${workspace.region ?? "Corporate"} · Objective vs risk-adjusted`,
    { x: 0.5, y: 3.5, w: 12, h: 0.5, fontSize: 16, color: "555555" },
  );

  const chart = pptx.addSlide();
  chart.addText("Monthly volume curves", {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.5,
    fontSize: 20,
    bold: true,
  });
  const labels = series.months.map((m) => m.month);
  chart.addChart(pptx.ChartType.line, [
    {
      name: "Objective (100% win)",
      labels,
      values: series.months.map((m) => m.objective),
    },
    {
      name: "Risk-adjusted",
      labels,
      values: series.months.map((m) => m.adjusted),
    },
  ], {
    x: 0.5,
    y: 1,
    w: 12.3,
    h: 5.5,
    showLegend: true,
  });

  const assumptions = pptx.addSlide();
  assumptions.addText("Assumptions (raw data unchanged)", {
    x: 0.5,
    y: 0.4,
    w: 12,
    h: 0.5,
    fontSize: 20,
    bold: true,
  });
  assumptions.addText(
    [
      `Pending win probability: ${DEFAULT_FORECAST_ASSUMPTIONS.pendingWinProbability}`,
      `Schedule slip (months): ${DEFAULT_FORECAST_ASSUMPTIONS.scheduleSlipMonths}`,
      `Objective total: ${series.totals.objective.toLocaleString()}`,
      `Adjusted total: ${series.totals.adjusted.toLocaleString()}`,
      `Excluded rounds: ${series.excluded.length}`,
    ].join("\n"),
    { x: 0.5, y: 1.2, w: 12, h: 4, fontSize: 16 },
  );

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": 'attachment; filename="precon-projection.pptx"',
    },
  });
}
