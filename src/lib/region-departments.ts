import { REFERENCE_LISTS } from "@/lib/reference-data";

/** Region → preconDepartment tree. Each department belongs to exactly one region. */
export const REGION_DEPARTMENTS: Record<string, readonly string[]> = {
  Carolinas: ["Carolinas"],
  Central: [
    "Central Building Group",
    "Central Federal",
    "Central Heavy Civil",
    "Central Nashville",
  ],
  Florida: ["Florida"],
  Georgia: [
    "Georgia – Commercial",
    "Georgia – Healthcare",
    "Georgia – Mission Critical & Industrial",
  ],
  Texas: ["Texas"],
};

export const REGION_ORDER = Object.keys(REGION_DEPARTMENTS);

export type RegionDepartmentNode = {
  region: string;
  departments: readonly string[];
};

export function regionDepartmentTree(allowedRegions: readonly string[] | "all" = "all"): RegionDepartmentNode[] {
  const regions = allowedRegions === "all" ? REGION_ORDER : REGION_ORDER.filter((r) => allowedRegions.includes(r));
  return regions.map((region) => ({
    region,
    departments: REGION_DEPARTMENTS[region] ?? [],
  }));
}

export function regionForDepartment(department: string): string | undefined {
  for (const [region, departments] of Object.entries(REGION_DEPARTMENTS)) {
    if (departments.includes(department)) return region;
  }
  return undefined;
}

export function departmentsForRegion(region: string): readonly string[] {
  return REGION_DEPARTMENTS[region] ?? [];
}

export function allDepartments(): string[] {
  return REGION_ORDER.flatMap((region) => [...(REGION_DEPARTMENTS[region] ?? [])]);
}

/** Throws if reference-list departments are missing from or duplicated in the tree. */
export function assertRegionDepartmentExhaustiveness(): void {
  const listed = REFERENCE_LISTS.preconDepartment.values;
  const mapped = allDepartments();
  const missing = listed.filter((value) => !mapped.includes(value));
  const extra = mapped.filter((value) => !listed.includes(value));
  const dupes = mapped.filter((value, i) => mapped.indexOf(value) !== i);
  if (missing.length || extra.length || dupes.length) {
    throw new Error(
      `Region/department map is not exhaustive: missing=${missing.join(", ") || "—"} extra=${extra.join(", ") || "—"} dupes=${dupes.join(", ") || "—"}`,
    );
  }
}
