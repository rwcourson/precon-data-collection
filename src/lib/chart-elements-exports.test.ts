import { CHART_COLORS } from "@rwcourson/chart-elements";
import { describe, expect, it } from "vitest";

const ENTRY_POINTS = [
  "@rwcourson/chart-elements/charts",
  "@rwcourson/chart-elements/cards",
  "@rwcourson/chart-elements/tables",
  "@rwcourson/chart-elements/slicers",
  "@rwcourson/chart-elements/maps",
  "@rwcourson/chart-elements/reports",
  "@rwcourson/chart-elements/analytics",
  "@rwcourson/chart-elements/declarative",
  "@rwcourson/chart-elements/overlays",
] as const;

describe("chart-elements published kit", () => {
  it("series colors are product --chart-1…--chart-8 tokens, not a single hue hex ramp", () => {
    expect([...CHART_COLORS]).toEqual([
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      "var(--chart-6)",
      "var(--chart-7)",
      "var(--chart-8)",
    ]);
  });

  it("imports every published bring-in entry point", async () => {
    const loaded = await Promise.all(
      ENTRY_POINTS.map(async (specifier) => {
        const mod = await import(specifier);
        return { specifier, keys: Object.keys(mod) };
      })
    );
    for (const entry of loaded) {
      expect(entry.keys.length, entry.specifier).toBeGreaterThan(0);
    }
  });
});
