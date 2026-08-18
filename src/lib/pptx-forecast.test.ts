import { describe, expect, it } from "vitest";
import { buildForecastPptx } from "@/lib/pptx-forecast";
import { DEFAULT_FORECAST_ASSUMPTIONS, type ForecastSeries } from "@/lib/forecast";

function fixtureSeries(): ForecastSeries {
  return {
    assumptions: DEFAULT_FORECAST_ASSUMPTIONS,
    months: [
      { month: "2026-01", objective: 40_000_000, adjusted: 22_000_000, contributingRoundIds: [1] },
      { month: "2026-02", objective: 25_000_000, adjusted: 14_000_000, contributingRoundIds: [2] },
    ],
    totals: { objective: 65_000_000, adjusted: 36_000_000 },
    excluded: [{ roundId: 9, reason: "missing_timing_date" }],
  };
}

describe("buildForecastPptx", () => {
  it("builds a branded four-slide projection deck", async () => {
    const { buffer, filename, slideCount } = await buildForecastPptx({
      series: fixtureSeries(),
      scopeLabel: "Florida",
    });
    expect(filename).toBe("volume-projection.pptx");
    expect(slideCount).toBe(4);
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const texts: string[] = [];
    let xmlBlob = "";
    for (const name of Object.keys(zip.files).filter((n) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(n),
    )) {
      const xml = await zip.file(name)!.async("string");
      xmlBlob += xml;
      for (const m of xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)) {
        texts.push(m[1]!);
      }
    }
    expect(texts.some((t) => t === "Volume Projection")).toBe(true);
    expect(texts.some((t) => t.includes("Brasfield") && t.includes("Gorrie"))).toBe(true);
    expect(texts.some((t) => t.includes("Pending win probability"))).toBe(true);
    expect(xmlBlob).toContain("002070");
  });
});
