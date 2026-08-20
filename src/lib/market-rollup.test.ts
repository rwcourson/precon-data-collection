import { describe, expect, it } from "vitest";
import { deriveMltFromMarketSector } from "./market-rollup";

describe("MLT derivation", () => {
  it("maps hyphen and en-dash market sector prefixes", () => {
    expect(deriveMltFromMarketSector("Healthcare - Acute")).toBe("Healthcare");
    expect(deriveMltFromMarketSector("Healthcare – Acute")).toBe("Healthcare");
    expect(deriveMltFromMarketSector("Mission Critical — Data Center")).toBe(
      "Mission Critical"
    );
    expect(deriveMltFromMarketSector(null)).toBeNull();
  });
});
