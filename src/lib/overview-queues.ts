/**
 * Overview action queues. Company-wide — flags and filters, never new statuses.
 */

import {
  EMPTY_HIERARCHY,
  type HierarchySelection,
} from "@/lib/bid-schedule-filter";
import { filterNeedsStaffing, needsStaffingHref } from "@/lib/staffing";

export type OverviewQueueId =
  | "needs-staffing"
  | "incomplete-post-bid"
  | "past-bid-due"
  | "unlinked"
  | "awaiting-lock"
  | "you-owe-post-bid";

export type OverviewQueueInput = {
  roundId: number;
  jobId: number;
  jobNumber: string;
  jobName: string;
  status: string;
  bidDueDate: string | null;
  isLinked: boolean;
  missingRequiredCount: number;
  preconDepartment: string;
  teamAssignedAt: Date | string | null;
  estimateLeadId?: number | null;
};

export type OverviewQueuePreview = {
  roundId: number;
  jobId: number;
  jobNumber: string;
  jobName: string;
};

export type OverviewQueue = {
  id: OverviewQueueId;
  title: string;
  description: string;
  href: string;
  count: number;
  preview: OverviewQueuePreview[];
};

export function calendarDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function preview(
  rows: OverviewQueueInput[],
  limit = 4
): OverviewQueuePreview[] {
  return rows.slice(0, limit).map((r) => ({
    roundId: r.roundId,
    jobId: r.jobId,
    jobNumber: r.jobNumber,
    jobName: r.jobName,
  }));
}

function uniqueByJob(rows: OverviewQueueInput[]): OverviewQueueInput[] {
  const seen = new Set<number>();
  return rows.filter((row) => {
    if (seen.has(row.jobId)) return false;
    seen.add(row.jobId);
    return true;
  });
}

export function buildOverviewQueues(
  rows: OverviewQueueInput[],
  today = new Date(),
  hierarchy: HierarchySelection = EMPTY_HIERARCHY,
  options: { uniqueJobs?: boolean; owedLeadId?: number } = {}
): OverviewQueue[] {
  const todayKey = calendarDate(today);
  const collapse = options.uniqueJobs
    ? uniqueByJob
    : (value: OverviewQueueInput[]) => value;
  const needsStaffing = collapse(filterNeedsStaffing(rows, hierarchy));

  const incomplete = collapse(
    rows.filter(
      (r) =>
        ["submitted", "post_bid"].includes(r.status) &&
        r.missingRequiredCount > 0
    )
  );
  const pastDue = collapse(
    rows.filter(
      (r) =>
        r.status === "active" && r.bidDueDate != null && r.bidDueDate < todayKey
    )
  );
  const unlinked = collapse(rows.filter((r) => !r.isLinked));
  const awaitingLock = collapse(rows.filter((r) => r.status === "post_bid"));
  const queues: OverviewQueue[] = [
    {
      id: "needs-staffing",
      title: "Needs staffing",
      description:
        "Upcoming rounds in this workspace with no team assigned yet.",
      href: needsStaffingHref(hierarchy),
      count: needsStaffing.length,
      preview: preview(needsStaffing),
    },
    {
      id: "incomplete-post-bid",
      title: "Incomplete post-bid",
      description: "Submitted rounds still missing required lock-gate fields.",
      href: "/post-bid?queue=incomplete",
      count: incomplete.length,
      preview: preview(incomplete),
    },
    {
      id: "past-bid-due",
      title: "Past bid due",
      description: "Active pursuits whose bid date has already passed.",
      href: "/bid-schedule?section=active&queue=past-due",
      count: pastDue.length,
      preview: preview(pastDue),
    },
    {
      id: "unlinked",
      title: "Unlinked TBD jobs",
      description:
        "Pursuits that have not been matched to Salesforce / Connect.",
      href: "/bid-schedule?queue=unlinked",
      count: unlinked.length,
      preview: preview(unlinked),
    },
    {
      id: "awaiting-lock",
      title: "Awaiting RPD lock",
      description:
        "Post-bid rounds waiting for Regional Precon Director approval.",
      href: "/post-bid?queue=awaiting-lock",
      count: awaitingLock.length,
      preview: preview(awaitingLock),
    },
  ];
  if (options.owedLeadId) {
    const owed = collapse(
      rows.filter(
        (r) =>
          r.estimateLeadId === options.owedLeadId &&
          ["submitted", "post_bid"].includes(r.status)
      )
    );
    queues.push({
      id: "you-owe-post-bid",
      title: "You owe post-bid",
      description: "Submitted efforts assigned to you that still need data.",
      href: "/post-bid?mine=1",
      count: owed.length,
      preview: preview(owed),
    });
  }
  return queues;
}
