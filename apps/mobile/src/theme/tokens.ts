/**
 * B&G Precon design tokens — tasteful grey layout, restrained navy accents.
 * Light: warm zinc greys. Dark: true charcoal (not navy-tinted muddy blue).
 * Brand (#0c2048 / steel) is accent only — not every label/icon fill.
 */

export type ColorSchemeName = "light" | "dark";

export type ThemeColors = {
  brand: string;
  brandMid: string;
  brandForeground: string;
  steel: string;
  /** Page canvas */
  background: string;
  sheet: string;
  canvas: string;
  white: string;
  foreground: string;
  muted: string;
  mutedSoft: string;
  border: string;
  input: string;
  glassBorder: string;
  glassFill: string;
  glassChrome: string;
  card: string;
  cardForeground: string;
  success: string;
  successSoft: string;
  successForeground: string;
  warning: string;
  warningSoft: string;
  warningForeground: string;
  info: string;
  infoSoft: string;
  infoForeground: string;
  destructive: string;
  destructiveSoft: string;
  destructiveForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  copper: string;
  tabBar: string;
  iconBtn: string;
  /** Default icon stroke color (chrome) — muted grey, not brand navy */
  icon: string;
  chip: string;
  chipOn: string;
  chipOnText: string;
  chipText: string;
};

/** Light — zinc greys + navy accent sparingly */
export const lightColors: ThemeColors = {
  brand: "#0c2048",
  brandMid: "#1a3360",
  brandForeground: "#fafafa",
  steel: "#8b95a8",
  background: "#f4f4f5",
  sheet: "#f4f4f5",
  canvas: "#e4e4e7",
  white: "#ffffff",
  foreground: "#18181b",
  muted: "#71717a",
  mutedSoft: "rgba(24, 24, 27, 0.05)",
  border: "rgba(24, 24, 27, 0.09)",
  input: "rgba(24, 24, 27, 0.05)",
  glassBorder: "rgba(255, 255, 255, 0.55)",
  glassFill: "rgba(255, 255, 255, 0.72)",
  glassChrome: "rgba(244, 244, 245, 0.92)",
  card: "rgba(255, 255, 255, 0.88)",
  cardForeground: "#18181b",
  success: "#3f7a45",
  successSoft: "#eef6ef",
  successForeground: "#1e3d22",
  warning: "#b45309",
  warningSoft: "#fff7ed",
  warningForeground: "#7c2d12",
  info: "#3f5a7a",
  infoSoft: "#f0f4f8",
  infoForeground: "#1e2f42",
  destructive: "#b33a2b",
  destructiveSoft: "#fef2f1",
  destructiveForeground: "#6b1f16",
  primary: "#0c2048",
  primaryForeground: "#fafafa",
  secondary: "rgba(24, 24, 27, 0.06)",
  secondaryForeground: "#18181b",
  copper: "#c9762b",
  tabBar: "rgba(244, 244, 245, 0.94)",
  iconBtn: "rgba(24, 24, 27, 0.05)",
  icon: "#52525b",
  chip: "rgba(24, 24, 27, 0.06)",
  chipOn: "#18181b",
  chipOnText: "#fafafa",
  chipText: "#3f3f46",
};

/** Dark — charcoal greys (not blue-navy canvas) */
export const darkColors: ThemeColors = {
  brand: "#c4cdd9",
  brandMid: "#a1a1aa",
  brandForeground: "#18181b",
  steel: "#a1a1aa",
  background: "#121214",
  sheet: "#121214",
  canvas: "#0a0a0b",
  white: "#1c1c1f",
  foreground: "#fafafa",
  muted: "#a1a1aa",
  mutedSoft: "rgba(255, 255, 255, 0.06)",
  border: "rgba(255, 255, 255, 0.09)",
  input: "rgba(255, 255, 255, 0.07)",
  glassBorder: "rgba(255, 255, 255, 0.1)",
  glassFill: "rgba(28, 28, 31, 0.82)",
  glassChrome: "rgba(18, 18, 20, 0.92)",
  card: "rgba(28, 28, 31, 0.92)",
  cardForeground: "#fafafa",
  success: "#86c48c",
  successSoft: "rgba(63, 122, 69, 0.22)",
  successForeground: "#d4f0d0",
  warning: "#e0a05c",
  warningSoft: "rgba(180, 83, 9, 0.22)",
  warningForeground: "#ffe8cc",
  info: "#9aadc4",
  infoSoft: "rgba(63, 90, 122, 0.28)",
  infoForeground: "#d6e2f0",
  destructive: "#e07a6c",
  destructiveSoft: "rgba(179, 58, 43, 0.28)",
  destructiveForeground: "#ffd5cf",
  primary: "#e4e4e7",
  primaryForeground: "#18181b",
  secondary: "rgba(255, 255, 255, 0.08)",
  secondaryForeground: "#fafafa",
  copper: "#e0a05c",
  tabBar: "rgba(18, 18, 20, 0.94)",
  iconBtn: "rgba(255, 255, 255, 0.07)",
  icon: "#a1a1aa",
  chip: "rgba(255, 255, 255, 0.08)",
  chipOn: "#fafafa",
  chipOnText: "#18181b",
  chipText: "#d4d4d8",
};

/** @deprecated Prefer useTheme().colors */
export const colors = lightColors;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const blur = {
  glass: 28,
  chrome: 48,
} as const;

/** Lucide thin-stroke defaults — match regular text weight optically. */
export const ICON_DEFAULTS = {
  /** Default list / body icon size */
  size: 20,
  /** Header / chrome icon size */
  chromeSize: 18,
  /** Tab bar icon size */
  tabSize: 22,
  /** Thin stroke (Lucide default is 2; we use 1.5 for tasteful weight) */
  strokeWidth: 1.5,
  /** Slightly heavier when selected/active only */
  strokeWidthActive: 1.75,
} as const;

export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semiBold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extraBold: "Manrope_800ExtraBold",
} as const;

export const typography = {
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    letterSpacing: -0.25,
  },
  body: {
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  callout: {
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  caption: {
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  micro: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.4,
  },
} as const;

export function paletteFor(scheme: ColorSchemeName): ThemeColors {
  return scheme === "dark" ? darkColors : lightColors;
}

export function resolveScheme(
  preference: "light" | "dark" | "system",
  system: ColorSchemeName | null | undefined,
): ColorSchemeName {
  if (preference === "system") {
    return system === "dark" ? "dark" : "light";
  }
  return preference;
}

/** Parse #rgb / #rrggbb (and strip alpha if present) → 0–1 channels. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const t = hex.trim().replace(/^#/, "");
  if (t.length === 3) {
    const r = parseInt(t[0] + t[0], 16);
    const g = parseInt(t[1] + t[1], 16);
    const b = parseInt(t[2] + t[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r: r / 255, g: g / 255, b: b / 255 };
  }
  if (t.length >= 6) {
    const r = parseInt(t.slice(0, 2), 16);
    const g = parseInt(t.slice(2, 4), 16);
    const b = parseInt(t.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r: r / 255, g: g / 255, b: b / 255 };
  }
  return null;
}

function channelLuma(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance for solid hex colors. */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return 0.2126 * channelLuma(rgb.r) + 0.7152 * channelLuma(rgb.g) + 0.0722 * channelLuma(rgb.b);
}

/** WCAG contrast ratio between two solid hex colors. */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  if (a == null || b == null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
