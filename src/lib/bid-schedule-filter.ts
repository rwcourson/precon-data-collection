import {
  departmentsForRegion,
  regionDepartmentTree,
  regionForDepartment,
} from "@/lib/region-departments";

export type HierarchySelection = {
  /** Fully selected regions (all child departments implied). */
  regions: string[];
  /** Individually selected departments whose parent is not fully selected. */
  departments: string[];
};

export const EMPTY_HIERARCHY: HierarchySelection = {
  regions: [],
  departments: [],
};

export function canonicalizeHierarchy(
  selection: HierarchySelection
): HierarchySelection {
  const selectedDepts = new Set(expandHierarchy(selection));
  const regions: string[] = [];
  const departments: string[] = [];
  for (const node of regionDepartmentTree()) {
    const owned = node.departments.filter((d) => selectedDepts.has(d));
    if (owned.length === 0) continue;
    if (owned.length === node.departments.length) {
      regions.push(node.region);
    } else {
      departments.push(...owned);
    }
  }
  return { regions, departments };
}

export function expandHierarchy(selection: HierarchySelection): string[] {
  const out = new Set(selection.departments);
  for (const region of selection.regions) {
    for (const dept of departmentsForRegion(region)) out.add(dept);
  }
  return [...out];
}

export function isHierarchyEmpty(selection: HierarchySelection): boolean {
  return selection.regions.length === 0 && selection.departments.length === 0;
}

export function hierarchyEquals(
  a: HierarchySelection,
  b: HierarchySelection
): boolean {
  const left = expandHierarchy(canonicalizeHierarchy(a)).slice().sort();
  const right = expandHierarchy(canonicalizeHierarchy(b)).slice().sort();
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

export function toggleRegion(
  selection: HierarchySelection,
  region: string
): HierarchySelection {
  const expanded = new Set(expandHierarchy(selection));
  const children = departmentsForRegion(region);
  const allOn = children.length > 0 && children.every((d) => expanded.has(d));
  if (allOn) {
    for (const d of children) expanded.delete(d);
  } else {
    for (const d of children) expanded.add(d);
  }
  return canonicalizeHierarchy({ regions: [], departments: [...expanded] });
}

export function toggleDepartment(
  selection: HierarchySelection,
  department: string
): HierarchySelection {
  const expanded = new Set(expandHierarchy(selection));
  if (expanded.has(department)) expanded.delete(department);
  else expanded.add(department);
  return canonicalizeHierarchy({ regions: [], departments: [...expanded] });
}

export function constrainHierarchy(
  selection: HierarchySelection,
  allowedRegions: readonly string[] | "all"
): HierarchySelection {
  if (allowedRegions === "all") return canonicalizeHierarchy(selection);
  const allowed = new Set(allowedRegions);
  return canonicalizeHierarchy({
    regions: selection.regions.filter((r) => allowed.has(r)),
    departments: selection.departments.filter((d) => {
      const region = regionForDepartment(d);
      return region != null && allowed.has(region);
    }),
  });
}

const PARAM_SEP = ",";

export function serializeHierarchy(selection: HierarchySelection): {
  regions?: string;
  departments?: string;
} {
  const canonical = canonicalizeHierarchy(selection);
  return {
    regions: canonical.regions.length
      ? canonical.regions.join(PARAM_SEP)
      : undefined,
    departments: canonical.departments.length
      ? canonical.departments.join(PARAM_SEP)
      : undefined,
  };
}

export function parseHierarchyParam(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(PARAM_SEP)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseHierarchyFromSearchParams(
  params: Record<string, string | undefined>,
  opts?: {
    workspaceRegion?: string | null;
    viewRegions?: string[];
    viewDepartments?: string[];
    viewRegion?: string;
    allowedRegions?: readonly string[] | "all";
  }
): HierarchySelection {
  const fromUrl: HierarchySelection = {
    regions: parseHierarchyParam(params.regions),
    departments: parseHierarchyParam(params.departments),
  };
  const hasUrl =
    !isHierarchyEmpty(fromUrl) ||
    params.regions === "" ||
    params.departments === "";
  let selected: HierarchySelection;
  if (!isHierarchyEmpty(fromUrl)) {
    selected = fromUrl;
  } else if (hasUrl) {
    selected = EMPTY_HIERARCHY;
  } else if (opts?.viewRegions?.length || opts?.viewDepartments?.length) {
    selected = {
      regions: opts.viewRegions ?? [],
      departments: opts.viewDepartments ?? [],
    };
  } else if (params.region && params.region !== "all") {
    selected = { regions: [params.region], departments: [] };
  } else if (opts?.viewRegion && opts.viewRegion !== "all") {
    selected = { regions: [opts.viewRegion], departments: [] };
  } else if (opts?.workspaceRegion) {
    selected = { regions: [opts.workspaceRegion], departments: [] };
  } else {
    selected = EMPTY_HIERARCHY;
  }
  return constrainHierarchy(selected, opts?.allowedRegions ?? "all");
}

export function matchesHierarchy<T extends { preconDepartment: string }>(
  row: T,
  selection: HierarchySelection
): boolean {
  if (isHierarchyEmpty(selection)) return true;
  return expandHierarchy(selection).includes(row.preconDepartment);
}

export function filterByHierarchy<T extends { preconDepartment: string }>(
  rows: T[],
  selection: HierarchySelection
): T[] {
  if (isHierarchyEmpty(selection)) return rows;
  const allowed = new Set(expandHierarchy(selection));
  return rows.filter((row) => allowed.has(row.preconDepartment));
}

export function hierarchySummary(selection: HierarchySelection): string {
  const canonical = canonicalizeHierarchy(selection);
  if (isHierarchyEmpty(canonical)) return "All Regions";
  if (canonical.regions.length === 1 && canonical.departments.length === 0) {
    return canonical.regions[0]!;
  }
  if (canonical.regions.length === 0 && canonical.departments.length === 1) {
    return canonical.departments[0]!;
  }
  const deptCount = expandHierarchy(canonical).length;
  return `${deptCount} markets`;
}
