import type { BidScheduleGroupBy } from "@/domain/contracts";
import { bidScheduleGroupBySchema } from "@/domain/contracts";
import { groupRowsByField, type LabeledGroup } from "@/lib/sheets";

export const BID_SCHEDULE_GROUP_OPTIONS: {
  value: BidScheduleGroupBy;
  label: string;
}[] = [
  { value: "none", label: "No grouping" },
  { value: "preconDepartment", label: "Division" },
  { value: "marketSector", label: "Market sector" },
  { value: "estimatePhase", label: "Estimate phase" },
  { value: "bidDueDate", label: "Bid due date" },
];

export const BID_SCHEDULE_SORT_OPTIONS = BID_SCHEDULE_GROUP_OPTIONS.filter(
  (o) => o.value !== "none",
);

export type BidScheduleSortField = Exclude<BidScheduleGroupBy, "none">;

export type BidScheduleSort = {
  field: BidScheduleSortField;
  dir: "asc" | "desc";
};

export const LIFECYCLE_SECTION_ORDER = ["active", "upcoming", "outstanding"] as const;

export type LifecycleSectionKey = (typeof LIFECYCLE_SECTION_ORDER)[number];

export const LIFECYCLE_SECTION_LABELS: Record<LifecycleSectionKey, string> = {
  active: "Active",
  upcoming: "Upcoming",
  outstanding: "Outstanding",
};

export function parseBidScheduleGroupBy(
  raw: string | undefined,
): BidScheduleGroupBy {
  const parsed = bidScheduleGroupBySchema.safeParse(raw ?? "none");
  return parsed.success ? parsed.data : "none";
}

export function parseBidScheduleSort(
  fieldRaw: string | undefined,
  dirRaw: string | undefined,
): BidScheduleSort {
  const fieldParsed = bidScheduleGroupBySchema.safeParse(fieldRaw ?? "bidDueDate");
  const field: BidScheduleSortField =
    fieldParsed.success && fieldParsed.data !== "none"
      ? fieldParsed.data
      : "bidDueDate";
  const dir = dirRaw === "desc" ? "desc" : "asc";
  return { field, dir };
}

export type BidScheduleGroupable = {
  id: number;
  status: string;
  preconDepartment: string;
  marketSector: string | null;
  estimatePhase: string;
  bidDueDate: string | null;
  jobName: string;
  jobNumber: string;
  roundNumber: number;
};

function groupValue(
  row: BidScheduleGroupable,
  field: BidScheduleSortField,
): string | number | null {
  switch (field) {
    case "preconDepartment":
      return row.preconDepartment;
    case "marketSector":
      return row.marketSector;
    case "estimatePhase":
      return row.estimatePhase;
    case "bidDueDate":
      return row.bidDueDate;
  }
}

function compareRows(
  a: BidScheduleGroupable,
  b: BidScheduleGroupable,
  sort: BidScheduleSort,
): number {
  const av = groupValue(a, sort.field);
  const bv = groupValue(b, sort.field);
  let cmp = 0;
  if (av == null && bv == null) cmp = 0;
  else if (av == null) cmp = 1;
  else if (bv == null) cmp = -1;
  else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
  if (cmp === 0) {
    // Stable within-group / within-sort tie-breakers
    cmp = a.bidDueDate?.localeCompare(b.bidDueDate ?? "9999") ?? 0;
  }
  if (cmp === 0) cmp = a.jobName.localeCompare(b.jobName);
  if (cmp === 0) cmp = a.jobNumber.localeCompare(b.jobNumber);
  if (cmp === 0) cmp = a.roundNumber - b.roundNumber;
  if (cmp === 0) cmp = a.id - b.id;
  return sort.dir === "asc" ? cmp : -cmp;
}

export type BidScheduleSectionView<T extends BidScheduleGroupable> = {
  key: LifecycleSectionKey;
  label: string;
  rows: T[];
  groups: LabeledGroup<T>[] | null;
};

/**
 * Split into lifecycle buckets (Active → Upcoming → Outstanding), sort stably,
 * then optionally group within each bucket.
 */
export function buildBidScheduleSections<T extends BidScheduleGroupable>(
  rows: T[],
  groupBy: BidScheduleGroupBy,
  sort: BidScheduleSort,
): BidScheduleSectionView<T>[] {
  return LIFECYCLE_SECTION_ORDER.map((key) => {
    const sectionRows = rows
      .filter((r) => r.status === key)
      .sort((a, b) => compareRows(a, b, sort));
    const groups =
      groupBy === "none"
        ? null
        : groupRowsByField(sectionRows, (r) => groupValue(r, groupBy));
    return {
      key,
      label: LIFECYCLE_SECTION_LABELS[key],
      rows: sectionRows,
      groups,
    };
  }).filter((s) => s.rows.length > 0);
}
