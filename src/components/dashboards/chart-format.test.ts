import { describe, expect, it } from "vitest";
import {
  dollarsCompact,
  formatTableCell,
  humanizeCategory,
  percentLabel,
  scaleForMetric,
} from "./chart-format";

describe("chart-format", () => {
  it("compacts dollars for tooltips", () => {
    expect(dollarsCompact(31_000_000_000)).toBe("$31.0B");
    expect(dollarsCompact(271_200_000)).toBe("$271M");
  });

  it("scales currency so axes stay short", () => {
    const s = scaleForMetric([31_000_000_000, 8_000_000_000], "currency");
    expect(s.unitLabel).toBe("$B");
    expect(s.values[0]).toBeCloseTo(31, 5);
    expect(s.format(31)).toBe("$31.0B");
  });

  it("scales percent ratios to percentage points", () => {
    const s = scaleForMetric([0.026, 0.7], "percent");
    expect(s.values[0]).toBeCloseTo(2.6, 5);
    expect(s.values[1]).toBeCloseTo(70, 5);
    expect(s.format(2.6)).toBe("2.6%");
  });

  it("humanizes status enums", () => {
    expect(humanizeCategory("post_bid")).toBe("Post-bid");
    expect(humanizeCategory("successful")).toBe("Won");
  });

  it("formats table cells for win rate and fee %", () => {
    expect(formatTableCell("Win rate", 0.7)).toBe("70%");
    expect(formatTableCell("Fee %", 0.043)).toBe("4.3%");
    expect(formatTableCell("Pursuit volume", 3_300_000_000)).toBe("$3.3B");
  });

  it("formats percent labels from ratios", () => {
    expect(percentLabel(0.026)).toBe("2.6%");
  });
});
