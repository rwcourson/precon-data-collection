import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import { z } from "zod";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { getWorkspace } from "@/lib/workspace-server";
import {
  buildForecastSeries,
  DEFAULT_FORECAST_ASSUMPTIONS,
} from "@/lib/forecast";
import { buildCanvasPptx, safeFilename } from "@/lib/pptx-canvas";
import { resolveWidgets, type WidgetResolved } from "@/lib/dashboard-query";
import { widgetConfigSchema } from "@/lib/dashboard-domain";
import type { EstimateRound } from "@/db/schema";

const canvasBodySchema = z.object({
  source: z.enum(["canvas", "forecast"]).optional(),
  planName: z.string().trim().min(1).max(120).optional(),
  planDescription: z.string().trim().max(500).optional(),
  widgets: z
    .array(
      z.object({
        config: widgetConfigSchema,
        empty: z.boolean().optional(),
        kpi: z
          .object({
            value: z.string(),
            sub: z.string().optional(),
            raw: z.number().nullable().optional(),
          })
          .optional(),
        series: z
          .array(
            z.object({
              name: z.string(),
              value: z.number(),
              secondary: z.number().optional(),
            }),
          )
          .optional(),
        trend: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).optional(),
        trendKeys: z
          .array(z.object({ key: z.string(), label: z.string() }))
          .optional(),
        stacked: z
          .object({
            rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
            series: z.array(z.string()),
          })
          .optional(),
        table: z
          .object({
            columns: z.array(z.string()),
            rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
          })
          .optional(),
        combo: z
          .object({
            rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
            categoryKey: z.string(),
            barKeys: z.array(z.string()),
            lineKeys: z.array(z.string()),
          })
          .optional(),
        waterfall: z
          .object({
            points: z.array(
              z.object({
                name: z.string(),
                value: z.number(),
                type: z.enum(["increase", "decrease", "total"]),
              }),
            ),
          })
          .optional(),
      }),
    )
    .max(20)
    .optional(),
  /** If only configs are sent, re-resolve against live rounds. */
  widgetConfigs: z.array(widgetConfigSchema).max(20).optional(),
});

/** Forecast-only deck (legacy GET). */
async function forecastPptx() {
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
  chart.addChart(
    pptx.ChartType.line,
    [
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
    ],
    {
      x: 0.5,
      y: 1,
      w: 12.3,
      h: 5.5,
      showLegend: true,
    },
  );

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

/** GET keeps forecast projection deck for Forecast page. */
export async function GET() {
  return forecastPptx();
}

/**
 * POST builds a deck from the AI Copilot canvas (resolved widgets or configs).
 * Body: { planName, planDescription?, widgets? | widgetConfigs? }
 */
export async function POST(req: Request) {
  const principal = await getWebPrincipal();
  const workspace = await getWorkspace();
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = canvasBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid canvas export payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.source === "forecast") {
    return forecastPptx();
  }

  let widgets: WidgetResolved[] = [];
  if (parsed.data.widgets?.length) {
    widgets = parsed.data.widgets.map((w) => ({
      config: w.config,
      empty: w.empty ?? false,
      kpi: w.kpi
        ? { value: w.kpi.value, sub: w.kpi.sub, raw: w.kpi.raw ?? null }
        : undefined,
      series: w.series,
      trend: w.trend as WidgetResolved["trend"],
      trendKeys: w.trendKeys,
      stacked: w.stacked,
      table: w.table,
      combo: w.combo,
      waterfall: w.waterfall,
    }));
  } else if (parsed.data.widgetConfigs?.length) {
    const withJobs = await listRoundsWithJobsForPrincipal(principal);
    const rounds = withJobs.map((r) => r.round) as EstimateRound[];
    widgets = resolveWidgets(parsed.data.widgetConfigs, rounds);
  } else {
    return NextResponse.json(
      { error: "Provide widgets or widgetConfigs for canvas export" },
      { status: 400 },
    );
  }

  const { buffer, filename } = await buildCanvasPptx({
    planName: parsed.data.planName ?? "AI Copilot canvas",
    planDescription: parsed.data.planDescription,
    widgets,
    scopeLabel: workspace.region ?? "Corporate",
  });

  // Filename already sanitized in builder; belt-and-suspenders for Content-Disposition.
  const safe = safeFilename(filename.replace(/\.pptx$/i, "")) + ".pptx";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${safe}"`,
    },
  });
}
