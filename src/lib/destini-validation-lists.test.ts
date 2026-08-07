import { describe, expect, it } from "vitest";
import { compareDestiniLists } from "./destini-validation-lists";
import { REFERENCE_LISTS } from "./reference-data";

describe("compareDestiniLists", () => {
  it("reports no gaps against Destini-aligned seed lists (dash-insensitive)", () => {
    const gaps = compareDestiniLists(REFERENCE_LISTS);
    expect(gaps).toEqual([]);
  });

  it("flags missing Destini values", () => {
    const gaps = compareDestiniLists({
      ...REFERENCE_LISTS,
      region: { label: "Region", values: ["Central"] },
    });
    const region = gaps.find((g) => g.listKey === "region");
    expect(region?.missingInApp).toContain("Florida");
  });
});
