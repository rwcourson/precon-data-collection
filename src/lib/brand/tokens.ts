/**
 * Brasfield & Gorrie 2026 tokens for generated documents and decks.
 * Canonical values live in brand/brand-tokens.json.
 */

export const BRAND = {
  white: "FFFFFF",
  blue1: "B0FFFF",
  blue2: "3888FF",
  blue3: "0028F0",
  blue4: "002070",
  blue5: "00143C",
  gray1: "E8E8EC",
  gray2: "B2B2B8",
  gray3: "7C7C84",
  gray4: "4C4C56",
  black: "000000",
  ink: "11131A",
  hairline: "D4D6DC",
} as const;

/** Sharp Grotesk PE family names (verbatim). Verdana is the Office fallback. */
export const FONT = {
  title: "Sharp Grotesk PE SmBold 15",
  number: "Sharp Grotesk PE SmBold 20",
  label: "Sharp Grotesk PE Medium 20",
  eyebrow: "Sharp Grotesk PE Medium 22",
  body: "Sharp Grotesk PE Book 20",
  display: "Sharp Grotesk PE Thin 15",
  fallback: "Verdana",
} as const;

/** Data-viz series order: Navy → Blue 2 → Blue 3 → Blue 5 → Gray 1. */
export const CHART_COLORS = [
  BRAND.blue4,
  BRAND.blue2,
  BRAND.blue3,
  BRAND.blue5,
  BRAND.gray1,
] as const;

export const COMPANY_NAME = "Brasfield & Gorrie";
export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;
