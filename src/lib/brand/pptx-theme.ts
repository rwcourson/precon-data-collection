/**
 * Shared B&G slide chrome for generated PowerPoint.
 * Title slides: Blue 4, white logo/type. Content slides: white, navy headings.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type PptxGenJS from "pptxgenjs";
import {
  BRAND,
  CHART_COLORS,
  COMPANY_NAME,
  FONT,
  SLIDE_H,
  SLIDE_W,
} from "@/lib/brand/tokens";

type Pres = InstanceType<typeof PptxGenJS>;
type Slide = ReturnType<Pres["addSlide"]>;

const LOGO_W = 2.05;
const LOGO_H = LOGO_W / (4802.371 / 750);
const MARGIN = 0.55;

function logoData(file: string): string {
  const buf = readFileSync(join(process.cwd(), "src/lib/brand/assets", file));
  return `image/png;base64,${buf.toString("base64")}`;
}

let cached: { navy: string; white: string } | null = null;
function logos() {
  cached ??= {
    navy: logoData("bg-horizontal-navy.png"),
    white: logoData("bg-horizontal-white.png"),
  };
  return cached;
}

export function createBrandedPptx(
  pptx: Pres,
  meta: { title: string; subject?: string },
): void {
  pptx.defineLayout({ name: "WIDE", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "WIDE";
  pptx.author = COMPANY_NAME;
  pptx.company = COMPANY_NAME;
  pptx.title = meta.title;
  pptx.subject = meta.subject ?? "Preconstruction";
  pptx.theme = {
    headFontFace: FONT.title,
    bodyFontFace: FONT.body,
  };
}

export function formatDeckDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", { dateStyle: "medium" });
}

export function addTitleSlide(
  pptx: Pres,
  input: {
    eyebrow?: string;
    title: string;
    lead?: string;
    meta?: string[];
  },
): Slide {
  const slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    fill: { color: BRAND.blue4 },
    line: { color: BRAND.blue4 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: SLIDE_H - 0.72,
    w: SLIDE_W,
    h: 0.72,
    fill: { color: BRAND.blue5 },
    line: { color: BRAND.blue5 },
  });
  slide.addImage({
    data: logos().white,
    x: MARGIN,
    y: 0.42,
    w: LOGO_W,
    h: LOGO_H,
    altText: COMPANY_NAME,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 0.92,
    w: 1.35,
    h: 0.015,
    fill: { color: BRAND.white },
    line: { color: BRAND.white },
  });
  slide.addText((input.eyebrow ?? "Preconstruction").toUpperCase(), {
    x: MARGIN,
    y: 2.15,
    w: 12.2,
    h: 0.32,
    fontFace: FONT.eyebrow,
    fontSize: 11,
    color: BRAND.white,
    margin: 0,
    charSpacing: 2.4,
  });
  slide.addText(input.title, {
    x: MARGIN,
    y: 2.52,
    w: 12.2,
    h: 1.35,
    fontFace: FONT.title,
    fontSize: 36,
    color: BRAND.white,
    valign: "top",
    margin: 0,
  });
  if (input.lead?.trim()) {
    slide.addText(input.lead.trim(), {
      x: MARGIN,
      y: 4.0,
      w: 10.8,
      h: 1.15,
      fontFace: FONT.body,
      fontSize: 15,
      color: BRAND.white,
      valign: "top",
      margin: 0,
    });
  }
  const footer = [COMPANY_NAME, ...(input.meta ?? [])].filter(Boolean).join("  ·  ");
  slide.addText(footer, {
    x: MARGIN,
    y: 6.95,
    w: 12.2,
    h: 0.28,
    fontFace: FONT.body,
    fontSize: 11,
    color: "B8C0D0",
    margin: 0,
  });
  return slide;
}

export function addContentSlide(
  pptx: Pres,
  input: {
    eyebrow?: string;
    title: string;
    page: number;
    pages: number;
    footerNote?: string;
  },
): Slide {
  const slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    fill: { color: BRAND.white },
    line: { color: BRAND.white },
  });
  slide.addImage({
    data: logos().navy,
    x: MARGIN,
    y: 0.28,
    w: LOGO_W,
    h: LOGO_H,
    altText: COMPANY_NAME,
  });
  if (input.eyebrow) {
    slide.addText(input.eyebrow.toUpperCase(), {
      x: 8.4,
      y: 0.3,
      w: 4.4,
      h: 0.26,
      fontFace: FONT.eyebrow,
      fontSize: 10,
      color: BRAND.blue4,
      align: "right",
      margin: 0,
      charSpacing: 1.8,
    });
  }
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 0.72,
    w: SLIDE_W - MARGIN * 2,
    h: 0.01,
    fill: { color: BRAND.hairline },
    line: { color: BRAND.hairline },
  });
  slide.addText(input.title, {
    x: MARGIN,
    y: 0.86,
    w: 12.2,
    h: 0.42,
    fontFace: FONT.title,
    fontSize: 20,
    color: BRAND.blue4,
    margin: 0,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: SLIDE_H - 0.38,
    w: SLIDE_W,
    h: 0.38,
    fill: { color: BRAND.blue5 },
    line: { color: BRAND.blue5 },
  });
  slide.addText(input.footerNote ?? COMPANY_NAME, {
    x: MARGIN,
    y: 7.18,
    w: 8.4,
    h: 0.22,
    fontFace: FONT.body,
    fontSize: 10,
    color: "B8C0D0",
    margin: 0,
  });
  slide.addText(`${input.page}  /  ${input.pages}`, {
    x: 10.4,
    y: 7.18,
    w: 2.4,
    h: 0.22,
    fontFace: FONT.body,
    fontSize: 10,
    color: "B8C0D0",
    align: "right",
    margin: 0,
  });
  return slide;
}

export const CONTENT_CHART = {
  x: MARGIN,
  y: 1.42,
  w: SLIDE_W - MARGIN * 2,
  h: 5.2,
} as const;

export function brandChartOpts(extra: Record<string, unknown> = {}) {
  return {
    ...CONTENT_CHART,
    chartColors: [...CHART_COLORS],
    chartArea: {
      fill: { color: BRAND.white },
      roundedCorners: false,
    },
    plotArea: {
      fill: { color: BRAND.white },
      border: { pt: 0, color: BRAND.white },
    },
    showLegend: false,
    legendPos: "b" as const,
    legendFontFace: FONT.body,
    legendFontSize: 11,
    legendColor: BRAND.ink,
    showValue: false,
    showTitle: false,
    catAxisLabelColor: BRAND.gray4,
    catAxisLabelFontFace: FONT.body,
    catAxisLabelFontSize: 10,
    catAxisLineShow: false,
    catGridLine: { style: "none" as const },
    valAxisLabelColor: BRAND.gray4,
    valAxisLabelFontFace: FONT.body,
    valAxisLabelFontSize: 10,
    valAxisLineShow: false,
    valGridLine: { color: BRAND.gray1, size: 0.6, style: "solid" as const },
    lineDataSymbol: "none" as const,
    lineSize: 2.25,
    barGapWidthPct: 45,
    ...extra,
  };
}

export function tableHeaderCell(text: string) {
  return {
    text,
    options: {
      bold: false,
      fill: { color: BRAND.blue4 },
      color: BRAND.white,
      align: "left" as const,
      valign: "middle" as const,
      fontFace: FONT.label,
      fontSize: 10,
      margin: 6,
    },
  };
}

export function tableBodyCell(text: string, rowIndex: number) {
  return {
    text,
    options: {
      fill: { color: rowIndex % 2 === 0 ? BRAND.white : BRAND.gray1 },
      color: BRAND.ink,
      align: "left" as const,
      valign: "middle" as const,
      fontFace: FONT.body,
      fontSize: 11,
      margin: 6,
    },
  };
}

export { MARGIN, SLIDE_H, SLIDE_W };
