/**
 * Branded volume-projection deck (Forecast page).
 */
import PptxGenJS from "pptxgenjs";
import { dollarsCompact } from "@/components/dashboards/chart-format";
import {
  addContentSlide,
  addTitleSlide,
  brandChartOpts,
  createBrandedPptx,
  formatDeckDate,
  MARGIN,
  tableBodyCell,
  tableHeaderCell,
} from "@/lib/brand/pptx-theme";
import { BRAND, FONT } from "@/lib/brand/tokens";
import type { ForecastSeries } from "@/lib/forecast";
import { DEFAULT_FORECAST_ASSUMPTIONS } from "@/lib/forecast";

export async function buildForecastPptx(input: {
  series: ForecastSeries;
  scopeLabel: string;
}): Promise<{ buffer: Buffer; filename: string; slideCount: number }> {
  const { series, scopeLabel } = input;
  const pptx = new PptxGenJS();
  createBrandedPptx(pptx, {
    title: "Volume Projection",
    subject: `${scopeLabel} objective vs risk-adjusted`,
  });

  const pages = 4;
  const generated = formatDeckDate();

  addTitleSlide(pptx, {
    eyebrow: "Preconstruction",
    title: "Volume Projection",
    lead: `${scopeLabel} view of objective volume against a risk-adjusted curve. Raw estimate rounds are not changed.`,
    meta: [scopeLabel, generated],
  });

  const kpi = addContentSlide(pptx, {
    eyebrow: scopeLabel,
    title: "Projection Totals",
    page: 2,
    pages,
  });
  const cards = [
    {
      label: "Objective total",
      value: dollarsCompact(series.totals.objective),
      sub: "100% of priced volume at stated timing",
      anchor: true,
    },
    {
      label: "Risk-adjusted total",
      value: dollarsCompact(series.totals.adjusted),
      sub: `Pending win ${Math.round(DEFAULT_FORECAST_ASSUMPTIONS.pendingWinProbability * 100)}% · ${DEFAULT_FORECAST_ASSUMPTIONS.scheduleSlipMonths} mo slip`,
      anchor: false,
    },
    {
      label: "Months plotted",
      value: String(series.months.length),
      sub: series.months.length ? `${series.months[0]?.month} to ${series.months.at(-1)?.month}` : "No dated volume",
      anchor: false,
    },
    {
      label: "Rounds excluded",
      value: String(series.excluded.length),
      sub: "Missing value or timing date",
      anchor: false,
    },
  ];
  cards.forEach((card, i) => {
    const x = MARGIN + (i % 4) * 3.06;
    const y = 1.5;
    kpi.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 2.9,
      h: 2.15,
      fill: { color: card.anchor ? BRAND.blue5 : BRAND.white },
      line: { color: card.anchor ? BRAND.blue5 : BRAND.hairline, pt: 1 },
    });
    kpi.addText(card.label.toUpperCase(), {
      x: x + 0.18,
      y: y + 0.2,
      w: 2.54,
      h: 0.3,
      fontFace: FONT.eyebrow,
      fontSize: 10,
      color: card.anchor ? "B8C0D0" : BRAND.gray3,
      margin: 0,
      charSpacing: 1.1,
    });
    kpi.addText(card.value, {
      x: x + 0.18,
      y: y + 0.58,
      w: 2.54,
      h: 0.75,
      fontFace: FONT.number,
      fontSize: 26,
      color: card.anchor ? BRAND.white : BRAND.blue4,
      margin: 0,
    });
    kpi.addText(card.sub, {
      x: x + 0.18,
      y: y + 1.42,
      w: 2.54,
      h: 0.5,
      fontFace: FONT.body,
      fontSize: 11,
      color: card.anchor ? "B8C0D0" : BRAND.gray3,
      margin: 0,
    });
  });

  const chart = addContentSlide(pptx, {
    eyebrow: scopeLabel,
    title: "Monthly Volume Curves",
    page: 3,
    pages,
  });
  const labels = series.months.map((m) => m.month);
  const obj = series.months.map((m) => m.objective / 1_000_000);
  const adj = series.months.map((m) => m.adjusted / 1_000_000);
  if (labels.length) {
    chart.addChart(
      pptx.ChartType.line,
      [
        { name: "Objective", labels, values: obj },
        { name: "Risk-adjusted", labels, values: adj },
      ],
      brandChartOpts({
        showLegend: true,
        chartColors: [BRAND.blue4, BRAND.blue2],
        valAxisTitle: "$M",
        showValAxisTitle: true,
      }),
    );
  } else {
    chart.addText("No dated volume to plot. Rounds need an estimate value and a start or bid date.", {
      x: MARGIN,
      y: 3.2,
      w: 12.2,
      h: 0.6,
      fontFace: FONT.body,
      fontSize: 15,
      color: BRAND.gray3,
    });
  }

  const assumptions = addContentSlide(pptx, {
    eyebrow: scopeLabel,
    title: "Assumptions",
    page: 4,
    pages,
    footerNote: "Raw estimate-round data is unchanged",
  });
  assumptions.addTable(
    [
      [tableHeaderCell("Assumption"), tableHeaderCell("Value")],
      [
        tableBodyCell("Pending win probability", 0),
        tableBodyCell(`${Math.round(series.assumptions.pendingWinProbability * 100)}%`, 0),
      ],
      [
        tableBodyCell("Schedule slip on pending work", 1),
        tableBodyCell(`${series.assumptions.scheduleSlipMonths} months`, 1),
      ],
      [
        tableBodyCell("Objective total", 2),
        tableBodyCell(dollarsCompact(series.totals.objective), 2),
      ],
      [
        tableBodyCell("Risk-adjusted total", 3),
        tableBodyCell(dollarsCompact(series.totals.adjusted), 3),
      ],
      [
        tableBodyCell("Excluded rounds", 4),
        tableBodyCell(String(series.excluded.length), 4),
      ],
    ],
    {
      x: MARGIN,
      y: 1.5,
      w: 8.4,
      colW: [5.1, 3.3],
      border: [
        { pt: 0, color: BRAND.white },
        { pt: 0, color: BRAND.white },
        { pt: 0, color: BRAND.white },
        { pt: 0, color: BRAND.white },
      ],
      fontFace: FONT.body,
      valign: "middle",
    },
  );

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return { buffer, filename: "volume-projection.pptx", slideCount: pages };
}
