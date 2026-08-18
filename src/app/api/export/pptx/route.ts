import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { dashboardWidgets, type EstimateRound } from "@/db/schema";
import {
  listRoundsWithJobsForPrincipal,
  loadDashboardForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { widgetConfigSchema } from "@/lib/dashboard-domain";
import { resolveWidgets, type WidgetResolved } from "@/lib/dashboard-query";
import {
  buildForecastSeries,
  DEFAULT_FORECAST_ASSUMPTIONS,
  resolveForecastTimingDate,
} from "@/lib/forecast";
import { buildCanvasPptx, safeFilename } from "@/lib/pptx-canvas";
import { buildForecastPptx } from "@/lib/pptx-forecast";
import { getWorkspace } from "@/lib/workspace-server";

// Chart-heavy deck build over the full scoped dataset.
export const maxDuration = 120;

const canvasBodySchema = z.object({
  source: z.enum(["canvas", "forecast"]).optional(),
  dashboardId: z.number().int().positive().optional(),
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
            })
          )
          .optional(),
        trend: z
          .array(
            z.record(z.string(), z.union([z.string(), z.number(), z.null()]))
          )
          .optional(),
        trendKeys: z
          .array(z.object({ key: z.string(), label: z.string() }))
          .optional(),
        stacked: z
          .object({
            rows: z.array(
              z.record(z.string(), z.union([z.string(), z.number()]))
            ),
            series: z.array(z.string()),
          })
          .optional(),
        table: z
          .object({
            columns: z.array(z.string()),
            rows: z.array(
              z.record(z.string(), z.union([z.string(), z.number(), z.null()]))
            ),
          })
          .optional(),
        combo: z
          .object({
            rows: z.array(
              z.record(z.string(), z.union([z.string(), z.number()]))
            ),
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
              })
            ),
          })
          .optional(),
      })
    )
    .max(20)
    .optional(),
  /** If only configs are sent, re-resolve against live rounds. */
  widgetConfigs: z.array(widgetConfigSchema).max(20).optional(),
});

function pptxResponse(buffer: Buffer, filename: string) {
  const safe = `${safeFilename(filename.replace(/\.pptx$/i, ""))}.pptx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${safe}"`,
    },
  });
}

async function forecastPptx() {
  const [principal, workspace] = await Promise.all([
    getWebPrincipal(),
    getWorkspace(),
  ]);
  const rounds = await listRoundsWithJobsForPrincipal(principal);
  const series = buildForecastSeries(
    rounds.map((r) => ({
      id: r.round.id,
      jobId: r.job.id,
      jobNumber: r.job.jobNumber,
      jobName: r.job.jobName,
      estimateValue: r.round.estimateValue,
      timingDate: resolveForecastTimingDate({
        projectStartDate: r.round.projectStartDate,
        bidDueDate: r.round.bidDueDate,
      }),
      outcome: r.round.outcome,
      region: r.round.region,
    })),
    DEFAULT_FORECAST_ASSUMPTIONS
  );
  const { buffer, filename } = await buildForecastPptx({
    series,
    scopeLabel: workspace.region ?? "Corporate",
  });
  return pptxResponse(buffer, filename);
}

async function dashboardPptx(dashboardId: number) {
  const [principal, workspace] = await Promise.all([
    getWebPrincipal(),
    getWorkspace(),
  ]);
  const loaded = await loadDashboardForPrincipal(principal, dashboardId);
  if (!loaded) {
    return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
  }
  const [widgets, rows] = await Promise.all([
    db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, dashboardId))
      .orderBy(asc(dashboardWidgets.sortOrder)),
    listRoundsWithJobsForPrincipal(principal),
  ]);
  const resolved = resolveWidgets(
    widgets.map((w) => w.config),
    rows.map((r) => r.round) as EstimateRound[]
  );
  const { buffer, filename } = await buildCanvasPptx({
    planName: loaded.value.name,
    planDescription: loaded.value.description ?? undefined,
    widgets: resolved,
    scopeLabel: loaded.value.region ?? workspace.region ?? loaded.value.scope,
  });
  return pptxResponse(buffer, filename);
}

/** GET: forecast deck, or Studio canvas when `dashboardId` is present. */
export async function GET(req: NextRequest) {
  const dashboardId = Number(req.nextUrl.searchParams.get("dashboardId"));
  if (Number.isFinite(dashboardId) && dashboardId > 0) {
    return dashboardPptx(dashboardId);
  }
  return forecastPptx();
}

/**
 * POST builds a deck from the AI Copilot canvas (resolved widgets or configs).
 * Body: { planName, planDescription?, widgets? | widgetConfigs? | dashboardId? }
 */
export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = canvasBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid canvas export payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  if (parsed.data.source === "forecast") {
    return forecastPptx();
  }
  if (parsed.data.dashboardId) {
    return dashboardPptx(parsed.data.dashboardId);
  }

  const [principal, workspace] = await Promise.all([
    getWebPrincipal(),
    getWorkspace(),
  ]);
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
      {
        error:
          "Provide widgets, widgetConfigs, or dashboardId for canvas export",
      },
      { status: 400 }
    );
  }

  const { buffer, filename } = await buildCanvasPptx({
    planName: parsed.data.planName ?? "Preconstruction canvas",
    planDescription: parsed.data.planDescription,
    widgets,
    scopeLabel: workspace.region ?? "Corporate",
  });

  return pptxResponse(buffer, filename);
}
