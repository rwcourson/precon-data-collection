import { describe, expect, it } from "vitest";
import { mapDestiniRow, mapDestiniSheet } from "./destini-import";

describe("destini import map", () => {
  it("maps known headers onto field keys", () => {
    const row = mapDestiniRow(
      ["Job Number", "Estimate Phase", "Estimate Value", "Mystery Col"],
      ["2600123", "GMP", "12500000", "x"],
    );
    expect(row.jobNumber).toBe("2600123");
    expect(row.estimatePhase).toBe("GMP");
    expect(row.values.estimateValue).toBe(12_500_000);
    expect(row.unmappedHeaders).toContain("Mystery Col");
  });

  it("skips empty sheet rows", () => {
    const mapped = mapDestiniSheet(
      ["Job Number", "Estimate Value"],
      [
        ["", ""],
        ["26001", "100"],
      ],
    );
    expect(mapped).toHaveLength(1);
  });
});
