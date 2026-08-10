/**
 * Pure PPTX builder for Magnus / Studio canvas widgets.
 * Free of Next request objects so vitest can drive it.
 */
import PptxGenJS from "pptxgenjs";
import type { WidgetResolved } from "@/lib/dashboard-query";
import {
  dollarsCompact,
  formatTableCell,
  humanizeCategory,
  percentLabel,
} from "@/components/dashboards/chart-format";

export type CanvasPptxInput = {
  planName: string;
  planDescription?: string;
  widgets: WidgetResolved[];
  /** Optional scope label e.g. "Corporate" / "Florida". */
  scopeLabel?: string;
};

const NAVY = "002070";
const STEEL = "5b6675";
const INK = "10141c";

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
      .slice(0, 80) || "magnus-canvas"
  );
}

function numericSeries(
  points: { name: string; value: number }[],
): { labels: string[]; values: number[] } {
  const labels = points.map((p) => humanizeCategory(p.name).slice(0, 28));
  const values = points.map((p) => (Number.isFinite(p.value) ? p.value : 0));
  return { labels, values };
}

/** Build a multi-slide deck from resolved canvas widgets. */
export async function buildCanvasPptx(input: CanvasPptxInput): Promise<{
  buffer: Buffer;
  filename: string;
  slideCount: number;
}> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.author = "Magnus AI · B&G Precon";
  pptx.title = input.planName;
  let slideCount = 0;

  // —— Title slide ——
  const title = pptx.addSlide();
  slideCount += 1;
  title.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: "F4F7FB" },
  });
  title.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.18,
    h: 7.5,
    fill: { color: NAVY },
  });
  title.addText(input.planName, {
    x: 0.7,
    y: 2.4,
    w: 12,
    h: 0.9,
    fontSize: 32,
    bold: true,
    color: INK,
    fontFace: "Calibri",
  });
  title.addText(
    [
      input.planDescription?.trim() || "Preconstruction analytics canvas",
      input.scopeLabel ? `Scope: ${input.scopeLabel}` : null,
      `Generated ${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })} · Magnus AI`,
    ]
      .filter(Boolean)
      .join("\n"),
    {
      x: 0.7,
      y: 3.4,
      w: 11.5,
      h: 1.4,
      fontSize: 14,
      color: STEEL,
      fontFace: "Calibri",
    },
  );

  const chartKindSet = new Set<string>(PPTX_CHART_KINDS);
  const kpis = input.widgets.filter((w) => w.config.kind === "kpi" && w.kpi && !w.empty);
  const charts = input.widgets.filter((w) => !w.empty && chartKindSet.has(w.config.kind));
  const tables = input.widgets.filter(
    (w) => !w.empty && (w.config.kind === "table" || w.config.kind === "reconciliation") && w.table,
  );

  // —— KPI scorecard ——
  if (kpis.length) {
    const slide = pptx.addSlide();
    slideCount += 1;
    slide.addText("Key metrics", {
      x: 0.5,
      y: 0.35,
      w: 12,
      h: 0.45,
      fontSize: 20,
      bold: true,
      color: INK,
    });
    const cols = Math.min(4, kpis.length);
    const cardW = 12.2 / cols;
    kpis.slice(0, 8).forEach((w, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 0.5 + col * cardW;
      const y = 1.1 + row * 2.4;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: cardW - 0.25,
        h: 2.1,
        fill: { color: "FFFFFF" },
        line: { color: "D8DEE8", width: 1 },
        shadow: { type: "outer", color: "000000", blur: 4, opacity: 0.06, offset: 1 },
      });
      slide.addText(w.config.title, {
        x: x + 0.2,
        y: y + 0.25,
        w: cardW - 0.65,
        h: 0.4,
        fontSize: 12,
        color: STEEL,
      });
      slide.addText(w.kpi?.value ?? "—", {
        x: x + 0.2,
        y: y + 0.75,
        w: cardW - 0.65,
        h: 0.7,
        fontSize: 28,
        bold: true,
        color: NAVY,
      });
      if (w.kpi?.sub) {
        slide.addText(w.kpi.sub, {
          x: x + 0.2,
          y: y + 1.5,
          w: cardW - 0.65,
          h: 0.35,
          fontSize: 11,
          color: STEEL,
        });
      }
    });
  }

  // —— Chart slides ——
  for (const w of charts) {
    const slide = pptx.addSlide();
    slideCount += 1;
    slide.addText(w.config.title, {
      x: 0.5,
      y: 0.3,
      w: 12.3,
      h: 0.45,
      fontSize: 18,
      bold: true,
      color: INK,
    });

    const kind = w.config.kind;

    if ((kind === "bar" || kind === "horizontal_bar") && w.series?.length) {
      const { labels, values } = numericSeries(w.series);
      // pptxgenjs ChartType has bar (no separate column type in this version).
      slide.addChart(
        pptx.ChartType.bar,
        [{ name: w.config.title, labels, values }],
        {
          x: 0.5,
          y: 1,
          w: 12.3,
          h: 5.8,
          showLegend: false,
          showValue: false,
          chartColors: [NAVY],
          barGrouping: "clustered",
        },
      );
    } else if ((kind === "line" || kind === "area" || kind === "projection") && w.trend?.length) {
      const labels = w.trend.map((t) => String(t.year ?? t.name ?? ""));
      const values = w.trend.map((t) => Number(t.value ?? 0));
      slide.addChart(pptx.ChartType.line, [{ name: w.config.title, labels, values }], {
        x: 0.5,
        y: 1,
        w: 12.3,
        h: 5.8,
        showLegend: false,
        chartColors: [NAVY],
      });
    } else if ((kind === "pie" || kind === "donut") && w.series?.length) {
      const { labels, values } = numericSeries(w.series.filter((s) => s.value > 0));
      slide.addChart(
        kind === "donut" ? pptx.ChartType.doughnut : pptx.ChartType.pie,
        [{ name: w.config.title, labels, values }],
        {
          x: 2.5,
          y: 1,
          w: 8,
          h: 5.8,
          showLegend: true,
          showPercent: true,
        },
      );
    } else if (kind === "stacked_bar" && w.stacked?.rows.length) {
      const labels = w.stacked.rows.map((r) => String(r.year ?? r.name ?? ""));
      const series = w.stacked.series.slice(0, 6).map((s) => ({
        name: humanizeCategory(s),
        labels,
        values: w.stacked!.rows.map((r) => Number(r[s] ?? 0)),
      }));
      slide.addChart(pptx.ChartType.bar, series, {
        x: 0.5,
        y: 1,
        w: 12.3,
        h: 5.8,
        barGrouping: "stacked",
        showLegend: true,
      });
    } else if (kind === "combo" && w.combo?.rows.length) {
      const labels = w.combo.rows.map((r) => String(r[w.combo!.categoryKey] ?? ""));
      const barKey = w.combo.barKeys[0] ?? "volume";
      const lineKey = w.combo.lineKeys[0] ?? "winRate";
      slide.addChart(
        pptx.ChartType.bar,
        [
          {
            name: "Volume",
            labels,
            values: w.combo.rows.map((r) => Number(r[barKey] ?? 0)),
          },
        ],
        {
          x: 0.5,
          y: 1,
          w: 12.3,
          h: 5.8,
          showLegend: true,
          chartColors: [NAVY],
        },
      );
      // Secondary annotation for win rate average
      const avgWr =
        w.combo.rows.reduce((s, r) => s + Number(r[lineKey] ?? 0), 0) /
        Math.max(1, w.combo.rows.length);
      slide.addText(`Avg win rate (line series): ${avgWr.toFixed(1)}%`, {
        x: 0.5,
        y: 6.9,
        w: 12,
        h: 0.3,
        fontSize: 11,
        color: STEEL,
      });
    } else if (kind === "waterfall" && w.waterfall?.points.length) {
      const labels = w.waterfall.points.map((p) => humanizeCategory(p.name));
      const values = w.waterfall.points.map((p) =>
        p.type === "decrease" ? -Math.abs(p.value) : p.value,
      );
      slide.addChart(
        pptx.ChartType.bar,
        [{ name: "Pipeline bridge", labels, values }],
        {
          x: 0.5,
          y: 1,
          w: 12.3,
          h: 5.8,
          showLegend: false,
          chartColors: [NAVY],
        },
      );
    } else {
      slide.addText("Chart data unavailable for this widget.", {
        x: 0.5,
        y: 3,
        w: 12,
        h: 0.5,
        fontSize: 14,
        color: STEEL,
      });
    }
  }

  // —— Table slides ——
  for (const w of tables) {
    if (!w.table?.columns.length) continue;
    const slide = pptx.addSlide();
    slideCount += 1;
    slide.addText(w.config.title, {
      x: 0.5,
      y: 0.3,
      w: 12.3,
      h: 0.45,
      fontSize: 18,
      bold: true,
      color: INK,
    });
    const cols = w.table.columns;
    const rows = w.table.rows.slice(0, 12).map((row) =>
      cols.map((c) => {
        const cell = formatTableCell(c, row[c] ?? null);
        return cell == null ? "—" : String(cell);
      }),
    );
    const border = { pt: 0.5, color: "D8DEE8" } as const;
    slide.addTable(
      [
        cols.map((c) => ({
          text: c,
          options: { bold: true, fill: { color: NAVY }, color: "FFFFFF", align: "center" as const },
        })),
        ...rows.map((r) => r.map((text) => ({ text, options: { color: INK } }))),
      ],
      {
        x: 0.5,
        y: 1,
        w: 12.3,
        colW: cols.map(() => 12.3 / cols.length),
        border: [border, border, border, border],
        fontFace: "Calibri",
        fontSize: 11,
        color: INK,
      },
    );
  }

  // Guarantee ≥2 slides even if canvas was empty
  if (slideCount < 2) {
    const empty = pptx.addSlide();
    slideCount += 1;
    empty.addText("No widget data to chart yet — re-run Magnus with a scorecard request.", {
      x: 0.5,
      y: 3,
      w: 12,
      h: 0.6,
      fontSize: 16,
      color: STEEL,
    });
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return {
    buffer,
    filename: `${safeFilename(input.planName)}.pptx`,
    slideCount,
  };
}

/** Lightweight helpers re-exported for tests. */
export function summarizeWidgetsForPptx(widgets: WidgetResolved[]) {
  const chartKindSet = new Set<string>(PPTX_CHART_KINDS);
  return {
    kpis: widgets.filter((w) => w.config.kind === "kpi" && !w.empty).length,
    charts: widgets.filter((w) => chartKindSet.has(w.config.kind)).length,
    tables: widgets.filter((w) =>
      ["table", "reconciliation"].includes(w.config.kind),
    ).length,
  };
}

export { dollarsCompact, percentLabel };
