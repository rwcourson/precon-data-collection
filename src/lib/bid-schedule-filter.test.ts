import { describe, expect, it } from "vitest";
import {
  canonicalizeHierarchy,
  expandHierarchy,
  filterByHierarchy,
  hierarchyEquals,
  parseHierarchyFromSearchParams,
  serializeHierarchy,
  toggleDepartment,
  toggleRegion,
} from "@/lib/bid-schedule-filter";
import { departmentsForRegion } from "@/lib/region-departments";

const FIXTURE = [
  { id: 1, region: "Georgia", preconDepartment: "Georgia – Commercial" },
  { id: 2, region: "Georgia", preconDepartment: "Georgia – Healthcare" },
  {
    id: 3,
    region: "Georgia",
    preconDepartment: "Georgia – Mission Critical & Industrial",
  },
  { id: 4, region: "Florida", preconDepartment: "Florida" },
  { id: 5, region: "Central", preconDepartment: "Central Building Group" },
  { id: 6, region: "Central", preconDepartment: "Central Federal" },
  { id: 7, region: "Central", preconDepartment: "Central Heavy Civil" },
  { id: 8, region: "Central", preconDepartment: "Central Nashville" },
  { id: 9, region: "Texas", preconDepartment: "Texas" },
];

function ids(selection: { regions: string[]; departments: string[] }) {
  return filterByHierarchy(FIXTURE, selection).map((row) => row.id);
}

describe("hierarchical region-market filter", () => {
  it("selecting Georgia returns exactly the union of the three Georgia departments", () => {
    const georgia = ids({ regions: ["Georgia"], departments: [] });
    const union = ids({
      regions: [],
      departments: [...departmentsForRegion("Georgia")],
    });
    expect(georgia).toEqual([1, 2, 3]);
    expect(union).toEqual(georgia);
  });

  it("selecting the three Georgia departments individually equals selecting Georgia", () => {
    let selection = { regions: [] as string[], departments: [] as string[] };
    for (const dept of departmentsForRegion("Georgia")) {
      selection = toggleDepartment(selection, dept);
    }
    expect(canonicalizeHierarchy(selection)).toEqual({
      regions: ["Georgia"],
      departments: [],
    });
    expect(
      hierarchyEquals(selection, { regions: ["Georgia"], departments: [] })
    ).toBe(true);
    expect(ids(selection)).toEqual(
      ids({ regions: ["Georgia"], departments: [] })
    );
  });

  it("nests and filters Central's four departments identically", () => {
    const byRegion = ids({ regions: ["Central"], departments: [] });
    const byDepts = ids({
      regions: [],
      departments: [...departmentsForRegion("Central")],
    });
    expect(byRegion).toEqual([5, 6, 7, 8]);
    expect(byDepts).toEqual(byRegion);
  });

  it("round-trips selection through URL params", () => {
    const original = canonicalizeHierarchy({
      regions: [],
      departments: ["Georgia – Commercial", "Georgia – Healthcare"],
    });
    const encoded = serializeHierarchy(original);
    const restored = parseHierarchyFromSearchParams({
      regions: encoded.regions,
      departments: encoded.departments,
    });
    expect(hierarchyEquals(restored, original)).toBe(true);
    expect(expandHierarchy(restored).sort()).toEqual([
      "Georgia – Commercial",
      "Georgia – Healthcare",
    ]);
  });

  it("legacy region= URL still selects that region", () => {
    const parsed = parseHierarchyFromSearchParams({ region: "Florida" });
    expect(ids(parsed)).toEqual([4]);
  });

  it("partial toggle of Georgia leaves the parent un-canonicalized as a region", () => {
    const next = toggleDepartment(
      { regions: ["Georgia"], departments: [] },
      "Georgia – Commercial"
    );
    expect(next.regions).toEqual([]);
    expect(next.departments.sort()).toEqual([
      "Georgia – Healthcare",
      "Georgia – Mission Critical & Industrial",
    ]);
  });

  it("toggleRegion on Georgia selects then clears the three markets", () => {
    const on = toggleRegion({ regions: [], departments: [] }, "Georgia");
    expect(on).toEqual({ regions: ["Georgia"], departments: [] });
    const off = toggleRegion(on, "Georgia");
    expect(off).toEqual({ regions: [], departments: [] });
  });
});
