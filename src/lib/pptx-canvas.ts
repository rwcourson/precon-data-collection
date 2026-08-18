/**
 * Branded PPTX builder for Magnus / Studio canvas widgets.
 * Free of Next request objects so vitest can drive it.
 */
import PptxGenJS from "pptxgenjs";
import {
  formatTableCell,
  humanizeCategory,
  metricScaleKind,
  scaleForMetric,
} from "@/components/dashboards/chart-format";
import {
  addContentSlide,
  addTitleSlide,
  brandChartOpts,
  CONTENT_CHART,
  createBrandedPptx,
  formatDeckDate,
  MARGIN,
  tableBodyCell,
  tableHeaderCell,
} from "@/lib/brand/pptx-theme";
import { BRAND, CHART_COLORS, FONT } from "@/lib/brand/tokens";
import type { WidgetResolved } from "@/lib/dashboard-query";

export type CanvasPptxInput = {
  planName: string;
  planDescription?: string;
  widgets: WidgetResolved[];
  /** Optional scope label e.g. "Corporate" / "Florida". */
  scopeLabel?: string;
};

/** Widget kinds that render as chart slides in canvas PPTX export. */
export const PPTX_CHART_KINDS = [
  "bar",
  "horizontal_bar",
  "line",
  "area",
  "pie",
  "donut",
  "stacked_bar",
  "combo",
  "waterfall",
  "projection",
] as const;

export function safeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "preconstruction-canvas"
  );
}

function numericSeries(points: { name: string; value: number }[]): {
  labels: string[];
  values: number[];
} {
  const labels = points.map((p) => humanizeCategory(p.name).slice(0, 28));
  const values = points.map((p) => (Number.isFinite(p.value) ? p.value : 0));
  return { labels, values };
}

function partitionWidgets(widgets: WidgetResolved[]) {
  const chartKindSet = new Set<string>(PPTX_CHART_KINDS);
  return {
    kpis: widgets.filter((w) => w.config.kind === "kpi" && w.kpi && !w.empty),
    charts: widgets.filter((w) => !w.empty && chartKindSet.has(w.config.kind)),
    tables: widgets.filter(
      (w) =>
        !w.empty &&
        (w.config.kind === "table" || w.config.kind === "reconciliation") &&
        w.table
    ),
  };
}

function plannedSlideCount(input: CanvasPptxInput): number {
  const { kpis, charts, tables } = partitionWidgets(input.widgets);
  let n = 1;
  if (kpis.length) n += 1;
  n += charts.length;
  n += tables.filter((w) => w.table?.columns.length).length;
  return Math.max(n, 2);
}

/** Build a multi-slide deck from resolved canvas widgets. */
export async function buildCanvasPptx(input: CanvasPptxInput): Promise<{
  buffer: Buffer;
  filename: string;
  slideCount: number;
}> {
  const pptx = new PptxGenJS();
  createBrandedPptx(pptx, {
    title: input.planName,
    subject: input.planDescription ?? "Preconstruction canvas",
  });

  const pages = plannedSlideCount(input);
  let page = 1;
  const generated = formatDeckDate();
  const { kpis, charts, tables } = partitionWidgets(input.widgets);

  addTitleSlide(pptx, {
    eyebrow: "Preconstruction",
    title: input.planName,
    lead:
      input.planDescription?.trim() ||
      "Analytics canvas for pursuit volume, win rate, and estimate rounds.",
    meta: [input.scopeLabel, generated].filter(Boolean) as string[],
  });

  if (kpis.length) {
    page += 1;
    const slide = addContentSlide(pptx, {
      eyebrow: input.scopeLabel,
      title: "Key Metrics",
      page,
      pages,
    });
    const cols = Math.min(4, kpis.length);
    const cardW = SLIDE_INNER_W / cols;
    kpis.slice(0, 8).forEach((w, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = MARGIN + col * cardW;
      const y = 1.45 + row * 2.45;
      const wCard = cardW - 0.18;
      const anchor = i === 0;
      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: wCard,
        h: 2.25,
        fill: { color: anchor ? BRAND.blue5 : BRAND.white },
        line: { color: anchor ? BRAND.blue5 : BRAND.hairline, pt: 1 },
      });
      slide.addText(w.config.title.toUpperCase(), {
        x: x + 0.2,
        y: y + 0.22,
        w: wCard - 0.4,
        h: 0.32,
        fontFace: FONT.eyebrow,
        fontSize: 10,
        color: anchor ? "B8C0D0" : BRAND.gray3,
        margin: 0,
        charSpacing: 1.2,
      });
      slide.addText(w.kpi?.value ?? "—", {
        x: x + 0.2,
        y: y + 0.62,
        w: wCard - 0.4,
        h: 0.85,
        fontFace: FONT.number,
        fontSize: 28,
        color: anchor ? BRAND.white : BRAND.blue4,
        valign: "middle",
        margin: 0,
      });
      if (w.kpi?.sub) {
        slide.addText(w.kpi.sub, {
          x: x + 0.2,
          y: y + 1.58,
          w: wCard - 0.4,
          h: 0.42,
          fontFace: FONT.body,
          fontSize: 11,
          color: anchor ? "B8C0D0" : BRAND.gray3,
          margin: 0,
        });
      }
    });
  }

  for (const w of charts) {
    page += 1;
    const slide = addContentSlide(pptx, {
      eyebrow: input.scopeLabel,
      title: w.config.title,
      page,
      pages,
    });
    paintChart(pptx, slide, w);
  }

  for (const w of tables) {
    if (!w.table?.columns.length) continue;
    page += 1;
    const slide = addContentSlide(pptx, {
      eyebrow: input.scopeLabel,
      title: w.config.title,
      page,
      pages,
    });
    const cols = w.table.columns;
    const rows = w.table.rows.slice(0, 14).map((row) =>
      cols.map((c) => {
        const cell = formatTableCell(c, row[c] ?? null);
        return cell == null ? "—" : String(cell);
      })
    );
    slide.addTable(
      [
        cols.map((c) => tableHeaderCell(c)),
        ...rows.map((r, i) => r.map((text) => tableBodyCell(text, i))),
      ],
      {
        x: MARGIN,
        y: 1.42,
        w: SLIDE_INNER_W,
        colW: cols.map(() => SLIDE_INNER_W / cols.length),
        border: [
          { pt: 0, color: BRAND.white },
          { pt: 0, color: BRAND.white },
          { pt: 0, color: BRAND.white },
          { pt: 0, color: BRAND.white },
        ],
        fontFace: FONT.body,
        fontSize: 11,
        color: BRAND.ink,
        valign: "middle",
      }
    );
  }

  if (page < 2) {
    addContentSlide(pptx, {
      title: "No Widget Data",
      page: 2,
      pages: 2,
    }).addText(
      "This canvas has no scored widgets yet. Add a KPI, chart, or table and export again.",
      {
        x: MARGIN,
        y: 3.1,
        w: 12.2,
        h: 0.7,
        fontFace: FONT.body,
        fontSize: 16,
        color: BRAND.gray3,
      }
    );
    page = 2;
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return {
    buffer,
    filename: `${safeFilename(input.planName)}.pptx`,
    slideCount: page,
  };
}

const SLIDE_INNER_W = 13.333 - MARGIN * 2;

function paintChart(
  pptx: InstanceType<typeof PptxGenJS>,
  slide: ReturnType<InstanceType<typeof PptxGenJS>["addSlide"]>,
  w: WidgetResolved
) {
  const kind = w.config.kind;
  const metricKey = w.config.metricKey;

  if ((kind === "bar" || kind === "horizontal_bar") && w.series?.length) {
    const { labels, values } = numericSeries(w.series);
    const scaled = scaleForMetric(values, metricScaleKind(metricKey));
    slide.addChart(
      pptx.ChartType.bar,
      [{ name: w.config.title, labels, values: scaled.values }],
      brandChartOpts({
        barDir: kind === "horizontal_bar" ? "bar" : "col",
        barGrouping: "clustered",
        valAxisTitle: scaled.unitLabel || undefined,
        showValAxisTitle: Boolean(scaled.unitLabel),
      })
    );
    return;
  }

  if (
    (kind === "line" || kind === "area" || kind === "projection") &&
    w.trend?.length
  ) {
    const labels = w.trend.map((t) => String(t.year ?? t.name ?? ""));
    const values = w.trend.map((t) => Number(t.value ?? 0));
    const scaled = scaleForMetric(values, metricScaleKind(metricKey));
    slide.addChart(
      kind === "area" ? pptx.ChartType.area : pptx.ChartType.line,
      [{ name: w.config.title, labels, values: scaled.values }],
      brandChartOpts({
        chartColors: [BRAND.blue4],
        valAxisTitle: scaled.unitLabel || undefined,
        showValAxisTitle: Boolean(scaled.unitLabel),
      })
    );
    return;
  }

  if ((kind === "pie" || kind === "donut") && w.series?.length) {
    const { labels, values } = numericSeries(
      w.series.filter((s) => s.value > 0)
    );
    slide.addChart(
      kind === "donut" ? pptx.ChartType.doughnut : pptx.ChartType.pie,
      [{ name: w.config.title, labels, values }],
      brandChartOpts({
        x: 2.6,
        y: 1.5,
        w: 8.1,
        h: 5.0,
        showLegend: true,
        showPercent: true,
        holeSize: kind === "donut" ? 58 : undefined,
      })
    );
    return;
  }

  if (kind === "stacked_bar" && w.stacked?.rows.length) {
    const labels = w.stacked.rows.map((r) => String(r.year ?? r.name ?? ""));
    const rawSeries = w.stacked.series.slice(0, 6);
    const firstValues = w.stacked.rows.map((r) =>
      Number(r[rawSeries[0] ?? ""] ?? 0)
    );
    const scaled = scaleForMetric(firstValues, metricScaleKind(metricKey));
    const series = rawSeries.map((s) => ({
      name: humanizeCategory(s),
      labels,
      values: w.stacked!.rows.map((r) => Number(r[s] ?? 0) / scaled.scale),
    }));
    slide.addChart(
      pptx.ChartType.bar,
      series,
      brandChartOpts({
        barGrouping: "stacked",
        showLegend: true,
        chartColors: [...CHART_COLORS],
        valAxisTitle: scaled.unitLabel || undefined,
        showValAxisTitle: Boolean(scaled.unitLabel),
      })
    );
    return;
  }

  if (kind === "combo" && w.combo?.rows.length) {
    const labels = w.combo.rows.map((r) =>
      String(r[w.combo!.categoryKey] ?? "")
    );
    const barKey = w.combo.barKeys[0] ?? "volume";
    const lineKey = w.combo.lineKeys[0] ?? "winRate";
    const barRaw = w.combo.rows.map((r) => Number(r[barKey] ?? 0));
    const scaled = scaleForMetric(barRaw, "currency");
    const comboOpts = brandChartOpts({
      showLegend: true,
      valAxes: [
        {
          valAxisTitle: scaled.unitLabel || "$",
          showValAxisTitle: true,
          valAxisLabelColor: BRAND.gray4,
        },
        {
          valAxisTitle: "%",
          showValAxisTitle: true,
          valAxisLabelColor: BRAND.gray4,
        },
      ],
    });
    // Multi-type charts take options as the second argument (pptxgenjs runtime).
    slide.addChart(
      [
        {
          type: pptx.ChartType.bar,
          data: [
            {
              name: "Volume",
              labels,
              values: scaled.values,
            },
          ],
          options: { chartColors: [BRAND.blue4] },
        },
        {
          type: pptx.ChartType.line,
          data: [
            {
              name: "Win rate",
              labels,
              values: w.combo.rows.map((r) => Number(r[lineKey] ?? 0)),
            },
          ],
          options: {
            chartColors: [BRAND.blue2],
            secondaryValAxis: true,
          },
        },
      ],
      comboOpts as unknown as []
    );
    return;
  }

  if (kind === "waterfall" && w.waterfall?.points.length) {
    const labels = w.waterfall.points.map((p) => humanizeCategory(p.name));
    const values = w.waterfall.points.map((p) =>
      p.type === "decrease" ? -Math.abs(p.value) : p.value
    );
    const scaled = scaleForMetric(values.map(Math.abs), "currency");
    slide.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Pipeline bridge",
          labels,
          values: values.map((v) => v / scaled.scale),
        },
      ],
      brandChartOpts({
        chartColors: [BRAND.blue4],
        valAxisTitle: scaled.unitLabel || undefined,
        showValAxisTitle: Boolean(scaled.unitLabel),
      })
    );
    return;
  }

  slide.addText("Chart data is unavailable for this widget.", {
    x: CONTENT_CHART.x,
    y: 3.2,
    w: CONTENT_CHART.w,
    h: 0.5,
    fontFace: FONT.body,
    fontSize: 14,
    color: BRAND.gray3,
  });
}

/** Lightweight helpers re-exported for tests. */
export function summarizeWidgetsForPptx(widgets: WidgetResolved[]) {
  const { kpis, charts, tables } = partitionWidgets(widgets);
  return {
    kpis: kpis.length,
    charts: charts.length,
    tables: tables.length,
  };
}
