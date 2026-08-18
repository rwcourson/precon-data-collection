import type { BidScheduleGroupBy } from "@/domain/contracts";
import { bidScheduleGroupBySchema } from "@/domain/contracts";
import {
  filterByHierarchy,
  parseHierarchyFromSearchParams,
} from "@/lib/bid-schedule-filter";
import { STATUS_LABELS } from "@/lib/labels";
import { groupRowsByField, type LabeledGroup } from "@/lib/sheets";

const EXPORT_SECTION_STATUSES: Record<
  string,
  Array<keyof typeof STATUS_LABELS>
> = {
  all: ["active", "upcoming", "outstanding"],
  active: ["active"],
  upcoming: ["upcoming"],
  outstanding: ["outstanding"],
};

/** Same section/region/phase/year/search/sort the Bid Schedule export route applies. */
export function applyBidScheduleExportScope<T extends Record<string, unknown>>(
  rows: T[],
  opts: {
    section?: string | null;
    region?: string | null;
    regions?: string | null;
    departments?: string | null;
    phase?: string | null;
    year?: string | null;
    q?: string | null;
    sortBy?: { field: string; dir: "asc" | "desc" }[];
  }
): T[] {
  const keys =
    EXPORT_SECTION_STATUSES[opts.section ?? "all"] ??
    EXPORT_SECTION_STATUSES.all;
  const statuses = keys.map((s) => STATUS_LABELS[s]);
  let filtered = rows.filter((r) => statuses.includes(String(r.status)));
  if (opts.regions || opts.departments) {
    const hierarchy = parseHierarchyFromSearchParams({
      regions: opts.regions ?? undefined,
      departments: opts.departments ?? undefined,
    });
    filtered = filterByHierarchy(
      filtered.map((r) => ({
        ...r,
        preconDepartment: String(r.preconDepartment ?? ""),
      })),
      hierarchy
    );
  } else if (opts.region) {
    filtered = filtered.filter((r) => r.region === opts.region);
  }
  if (opts.phase && opts.phase !== "all") {
    filtered = filtered.filter((r) => r.estimatePhase === opts.phase);
  }
  if (opts.year && opts.year !== "all") {
    filtered = filtered.filter((r) => String(r.bidYear) === opts.year);
  }
  const q = (opts.q ?? "").toLowerCase();
  if (q) {
    filtered = filtered.filter(
      (r) =>
        String(r.jobName ?? "")
          .toLowerCase()
          .includes(q) ||
        String(r.jobNumber ?? "")
          .toLowerCase()
          .includes(q)
    );
  }
  for (const s of [...(opts.sortBy ?? [])].reverse()) {
    filtered = [...filtered].sort((a, b) => {
      const av = a[s.field];
      const bv = b[s.field];
      const c =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""));
      return s.dir === "asc" ? c : -c;
    });
  }
  return filtered;
}

export const BID_SCHEDULE_GROUP_OPTIONS: {
  value: BidScheduleGroupBy;
  label: string;
}[] = [
  { value: "none", label: "No grouping" },
  { value: "preconDepartment", label: "Division" },
  { value: "marketSector", label: "Market sector" },
  { value: "estimatePhase", label: "Estimate phase" },
  { value: "bidDueDate", label: "Bid due date" },
  { value: "drawingsDueDate", label: "Drawings due" },
  { value: "bidReviewDate", label: "Bid review" },
];

export const BID_SCHEDULE_SORT_OPTIONS = BID_SCHEDULE_GROUP_OPTIONS.filter(
  (o) => o.value !== "none"
);

export type BidScheduleSortField = Exclude<BidScheduleGroupBy, "none">;

export type BidScheduleSort = {
  field: BidScheduleSortField;
  dir: "asc" | "desc";
};

export const LIFECYCLE_SECTION_ORDER = [
  "active",
  "upcoming",
  "outstanding",
] as const;

export type LifecycleSectionKey = (typeof LIFECYCLE_SECTION_ORDER)[number];

export const LIFECYCLE_SECTION_LABELS: Record<LifecycleSectionKey, string> = {
  active: "Active",
  upcoming: "Upcoming",
  outstanding: "Outstanding",
};

export function parseBidScheduleGroupBy(
  raw: string | undefined
): BidScheduleGroupBy {
  const parsed = bidScheduleGroupBySchema.safeParse(raw ?? "none");
  return parsed.success ? parsed.data : "none";
}

export function parseBidScheduleSort(
  fieldRaw: string | undefined,
  dirRaw: string | undefined
): BidScheduleSort {
  const fieldParsed = bidScheduleGroupBySchema.safeParse(
    fieldRaw ?? "bidDueDate"
  );
  const field: BidScheduleSortField =
    fieldParsed.success && fieldParsed.data !== "none"
      ? fieldParsed.data
      : "bidDueDate";
  const dir = dirRaw === "desc" ? "desc" : "asc";
  return { field, dir };
}

export type BidDueUrgency = "overdue" | "week" | "fortnight" | null;

/** Assignment-level urgency on bid due — overdue / ≤7d / ≤14d. Not resource planning. */
export function bidDueUrgency(
  date: string | null | undefined,
  today = new Date()
): BidDueUrgency {
  if (!date) return null;
  const due = new Date(`${date}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 7) return "week";
  if (days <= 14) return "fortnight";
  return null;
}

export const BID_DUE_URGENCY_LABEL: Record<
  Exclude<BidDueUrgency, null>,
  string
> = {
  overdue: "Overdue",
  week: "Due ≤7d",
  fortnight: "Due ≤14d",
};

export type BidScheduleViewQuery = {
  section?: string;
  group?: string;
  sort?: string;
  dir?: "asc" | "desc";
  region?: string;
  regions?: string[];
  departments?: string[];
  queue?: string;
  columns?: string[];
  density?: "summary" | "detail";
};

function bidScheduleSearchParams(
  config: BidScheduleViewQuery
): URLSearchParams {
  const p = new URLSearchParams();
  if (config.section && config.section !== "all")
    p.set("section", config.section);
  if (config.group && config.group !== "none") p.set("group", config.group);
  if (config.sort && config.sort !== "bidDueDate") p.set("sort", config.sort);
  if (config.dir && config.dir !== "asc") p.set("dir", config.dir);
  if (config.regions?.length) p.set("regions", config.regions.join(","));
  else if (config.region && config.region !== "all")
    p.set("region", config.region);
  if (config.departments?.length)
    p.set("departments", config.departments.join(","));
  if (config.density && config.density !== "summary")
    p.set("density", config.density);
  if (config.queue) p.set("queue", config.queue);
  return p;
}

export function bidScheduleViewHref(
  config: BidScheduleViewQuery,
  viewId: number
): string {
  const p = bidScheduleSearchParams(config);
  p.set("view", String(viewId));
  return `/bid-schedule?${p.toString()}`;
}

/** Leave a named view without re-applying the starred default. */
export function bidSchedulePrefsHref(config: BidScheduleViewQuery): string {
  const p = bidScheduleSearchParams(config);
  p.set("source", "prefs");
  return `/bid-schedule?${p.toString()}`;
}

export type BidScheduleGroupable = {
  id: number;
  status: string;
  preconDepartment: string;
  marketSector: string | null;
  estimatePhase: string;
  bidDueDate: string | null;
  drawingsDueDate?: string | null;
  bidReviewDate?: string | null;
  jobName: string;
  jobNumber: string;
  roundNumber: number;
};

function groupValue(
  row: BidScheduleGroupable,
  field: BidScheduleSortField
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
    case "drawingsDueDate":
      return row.drawingsDueDate ?? null;
    case "bidReviewDate":
      return row.bidReviewDate ?? null;
  }
}

function compareRows(
  a: BidScheduleGroupable,
  b: BidScheduleGroupable,
  sort: BidScheduleSort
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
  sort: BidScheduleSort
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
