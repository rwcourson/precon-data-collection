import { describe, expect, it } from "vitest";
import { PRODUCT_NAME, suggestHppFromEstimateValue } from "./product";

describe("product contract helpers", () => {
  it("keeps the temporary product label centralized", () => {
    expect(PRODUCT_NAME).toBe("B&G Precon — Pursuits & Data");
  });

  it("suggests HPP from estimate value without auto-setting a flag", () => {
    expect(suggestHppFromEstimateValue(199_999_999, 200_000_000)).toBe(false);
    expect(suggestHppFromEstimateValue(200_000_000, 200_000_000)).toBe(true);
    expect(suggestHppFromEstimateValue(null, 200_000_000)).toBe(false);
    expect(typeof suggestHppFromEstimateValue(250_000_000)).toBe("boolean");
  });
});
