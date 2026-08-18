/**
 * Exercises shipped Expo theme tokens at apps/mobile/src/theme/tokens.ts
 * (real import path — not a re-implementation).
 */
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  darkColors,
  hexToRgb,
  ICON_DEFAULTS,
  lightColors,
  paletteFor,
  relativeLuminance,
  resolveScheme,
} from "../../apps/mobile/src/theme/tokens";

describe("mobile theme tokens (shipped)", () => {
  it("ICON_DEFAULTS are thin Lucide stroke weights", () => {
    expect(ICON_DEFAULTS.strokeWidth).toBe(1.5);
    expect(ICON_DEFAULTS.strokeWidthActive).toBeGreaterThan(
      ICON_DEFAULTS.strokeWidth
    );
    expect(ICON_DEFAULTS.strokeWidth).toBeLessThan(2);
    expect(ICON_DEFAULTS.size).toBe(20);
    expect(ICON_DEFAULTS.chromeSize).toBe(18);
    expect(ICON_DEFAULTS.tabSize).toBe(22);
  });

  it("light canvas is grey (not blue-tinted navy sheet) and darker than white card", () => {
    expect(lightColors.background.toLowerCase()).toBe("#f4f4f5");
    const bg = relativeLuminance(lightColors.background)!;
    const card = relativeLuminance(lightColors.white)!;
    expect(card).toBeGreaterThan(bg);
    // Grey: R≈G≈B in hex
    const rgb = hexToRgb(lightColors.background)!;
    expect(Math.abs(rgb.r - rgb.g)).toBeLessThan(0.02);
    expect(Math.abs(rgb.g - rgb.b)).toBeLessThan(0.02);
  });

  it("dark canvas is charcoal grey, not navy-blue #161e2e", () => {
    expect(darkColors.background.toLowerCase()).toBe("#121214");
    expect(darkColors.background.toLowerCase()).not.toBe("#161e2e");
    const rgb = hexToRgb(darkColors.background)!;
    expect(Math.abs(rgb.r - rgb.g)).toBeLessThan(0.03);
    expect(Math.abs(rgb.g - rgb.b)).toBeLessThan(0.03);
  });

  it("foreground/background pairs meet readable contrast (≥4.5)", () => {
    const light = contrastRatio(
      lightColors.foreground,
      lightColors.background
    )!;
    const dark = contrastRatio(darkColors.foreground, darkColors.background)!;
    expect(light).toBeGreaterThanOrEqual(4.5);
    expect(dark).toBeGreaterThanOrEqual(4.5);
  });

  it("muted is softer than primary text on both schemes", () => {
    const lf = relativeLuminance(lightColors.foreground)!;
    const lm = relativeLuminance(lightColors.muted)!;
    expect(lm).toBeGreaterThan(lf); // muted lighter than black text
    const df = relativeLuminance(darkColors.foreground)!;
    const dm = relativeLuminance(darkColors.muted)!;
    expect(dm).toBeLessThan(df); // muted darker than white text
  });

  it("icon chrome color is grey, not brand navy fill", () => {
    expect(lightColors.icon.toLowerCase()).not.toBe(
      lightColors.brand.toLowerCase()
    );
    expect(lightColors.icon.toLowerCase()).toBe("#52525b");
    expect(darkColors.icon.toLowerCase()).toBe("#a1a1aa");
  });

  it("selected chips use near-black/white greys, not navy fills", () => {
    expect(lightColors.chipOn.toLowerCase()).toBe("#18181b");
    expect(darkColors.chipOn.toLowerCase()).toBe("#fafafa");
  });

  it("paletteFor and resolveScheme switch light/dark correctly", () => {
    expect(paletteFor("light").background).toBe(lightColors.background);
    expect(paletteFor("dark").background).toBe(darkColors.background);
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
    expect(resolveScheme("light", "dark")).toBe("light");
  });

  it("brand remains available as accent (primary) without dominating canvas", () => {
    expect(lightColors.primary.toLowerCase()).toBe("#0c2048");
    expect(lightColors.background.toLowerCase()).not.toBe(
      lightColors.brand.toLowerCase()
    );
    expect(darkColors.background.toLowerCase()).not.toMatch(
      /0c2048|002157|161e2e/
    );
  });
});
