import {
  filterByHierarchy,
  type HierarchySelection,
  serializeHierarchy,
} from "@/lib/bid-schedule-filter";

export const NEEDS_STAFFING_QUEUE = "needs-staffing";

export function isNeedsStaffingRow(row: {
  status: string;
  teamAssignedAt: Date | string | null | undefined;
}): boolean {
  return row.status === "upcoming" && row.teamAssignedAt == null;
}

export function filterNeedsStaffing<
  T extends {
    status: string;
    teamAssignedAt: Date | string | null | undefined;
    preconDepartment: string;
  },
>(rows: T[], hierarchy: HierarchySelection): T[] {
  return filterByHierarchy(rows.filter(isNeedsStaffingRow), hierarchy);
}

export function needsStaffingHref(hierarchy: HierarchySelection): string {
  const params = new URLSearchParams();
  params.set("section", "upcoming");
  params.set("queue", NEEDS_STAFFING_QUEUE);
  const serialized = serializeHierarchy(hierarchy);
  if (serialized.regions) params.set("regions", serialized.regions);
  if (serialized.departments) params.set("departments", serialized.departments);
  return `/bid-schedule?${params.toString()}`;
}
