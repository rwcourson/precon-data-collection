import { describe, expect, it } from "vitest";
import { REFERENCE_LISTS } from "@/lib/reference-data";
import {
  allDepartments,
  assertRegionDepartmentExhaustiveness,
  departmentsForRegion,
  REGION_DEPARTMENTS,
  regionDepartmentTree,
  regionForDepartment,
} from "@/lib/region-departments";

describe("region → department tree", () => {
  it("is exhaustive against the Destini preconDepartment reference list", () => {
    expect(() => assertRegionDepartmentExhaustiveness()).not.toThrow();
    expect(allDepartments().sort()).toEqual(
      [...REFERENCE_LISTS.preconDepartment.values].sort()
    );
  });

  it("maps Georgia to exactly its three markets", () => {
    expect([...departmentsForRegion("Georgia")]).toEqual([
      "Georgia – Commercial",
      "Georgia – Healthcare",
      "Georgia – Mission Critical & Industrial",
    ]);
  });

  it("nests Central's four departments", () => {
    expect([...departmentsForRegion("Central")]).toEqual([
      "Central Building Group",
      "Central Federal",
      "Central Heavy Civil",
      "Central Nashville",
    ]);
  });

  it("assigns each department to exactly one region", () => {
    const seen = new Map<string, string>();
    for (const [region, departments] of Object.entries(REGION_DEPARTMENTS)) {
      for (const dept of departments) {
        expect(seen.has(dept)).toBe(false);
        seen.set(dept, region);
        expect(regionForDepartment(dept)).toBe(region);
      }
    }
  });

  it("limits the tree to allowed regions", () => {
    expect(regionDepartmentTree(["Georgia"]).map((n) => n.region)).toEqual([
      "Georgia",
    ]);
  });
});
