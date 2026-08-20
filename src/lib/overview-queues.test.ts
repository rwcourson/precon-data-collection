import { describe, expect, it } from "vitest";
import {
  parseHierarchyFromSearchParams,
  serializeHierarchy,
} from "@/lib/bid-schedule-filter";
import { filterNeedsStaffing, needsStaffingHref } from "@/lib/staffing";
import {
  buildOverviewQueues,
  calendarDate,
  type OverviewQueueInput,
} from "./overview-queues";

function row(
  partial: Partial<OverviewQueueInput> & Pick<OverviewQueueInput, "roundId">
): OverviewQueueInput {
  return {
    jobId: partial.roundId,
    jobNumber: `J-${partial.roundId}`,
    jobName: `Job ${partial.roundId}`,
    status: "active",
    bidDueDate: null,
    isLinked: true,
    missingRequiredCount: 0,
    preconDepartment: "Central Building Group",
    teamAssignedAt: null,
    ...partial,
  };
}

describe("overview queues", () => {
  const today = new Date("2026-08-14T12:00:00");

  it("formats a local calendar date without UTC shift", () => {
    expect(calendarDate(today)).toBe("2026-08-14");
  });

  it("buckets incomplete post-bid, past due, unlinked, and awaiting lock without new statuses", () => {
    const queues = buildOverviewQueues(
      [
        row({ roundId: 1, status: "submitted", missingRequiredCount: 4 }),
        row({ roundId: 2, status: "post_bid", missingRequiredCount: 0 }),
        row({ roundId: 3, status: "post_bid", missingRequiredCount: 2 }),
        row({ roundId: 4, status: "active", bidDueDate: "2026-08-01" }),
        row({ roundId: 5, status: "active", bidDueDate: "2026-08-20" }),
        row({
          roundId: 6,
          status: "upcoming",
          isLinked: false,
          jobNumber: "TBD-0042",
        }),
        row({ roundId: 7, status: "locked", missingRequiredCount: 0 }),
      ],
      today
    );

    expect(queues.map((q) => [q.id, q.count])).toEqual([
      ["needs-staffing", 1],
      ["incomplete-post-bid", 2],
      ["past-bid-due", 1],
      ["unlinked", 1],
      ["awaiting-lock", 2],
    ]);
    expect(queues[0]?.href).toBe(
      "/bid-schedule?section=upcoming&queue=needs-staffing"
    );
    expect(queues[1]?.href).toBe("/post-bid?queue=incomplete");
    expect(queues[2]?.href).toBe("/bid-schedule?section=active&queue=past-due");
    expect(queues[3]?.href).toBe("/bid-schedule?queue=unlinked");
    expect(queues[4]?.href).toBe("/post-bid?queue=awaiting-lock");
  });

  it("does not treat blank bid due as past due", () => {
    const queues = buildOverviewQueues(
      [row({ roundId: 1, status: "active", bidDueDate: null })],
      today
    );
    expect(queues.find((q) => q.id === "past-bid-due")?.count).toBe(0);
  });

  it("needs-staffing overview count equals the preset-filtered schedule and deep-link", () => {
    const rows = [
      row({
        roundId: 1,
        status: "upcoming",
        preconDepartment: "Central Building Group",
      }),
      row({ roundId: 2, status: "upcoming", preconDepartment: "Florida" }),
      row({
        roundId: 3,
        status: "upcoming",
        preconDepartment: "Central Nashville",
        teamAssignedAt: "2026-08-14T12:00:00.000Z",
      }),
      row({
        roundId: 4,
        status: "active",
        preconDepartment: "Central Building Group",
      }),
      row({
        roundId: 5,
        status: "upcoming",
        preconDepartment: "Central Heavy Civil",
      }),
    ];
    const hierarchy = parseHierarchyFromSearchParams(
      {},
      { workspaceRegion: "Central", allowedRegions: ["Central"] }
    );
    const queues = buildOverviewQueues(rows, today, hierarchy);
    const staffing = queues.find((q) => q.id === "needs-staffing");
    const schedule = filterNeedsStaffing(rows, hierarchy);
    expect(staffing?.count).toBe(schedule.length);
    expect(staffing?.count).toBe(2);
    expect(schedule.map((r) => r.roundId).sort()).toEqual([1, 5]);

    const href = staffing?.href ?? "";
    expect(href).toBe(needsStaffingHref(hierarchy));
    const params = Object.fromEntries(
      new URL(href, "http://local").searchParams.entries()
    );
    expect(params.section).toBe("upcoming");
    expect(params.queue).toBe("needs-staffing");
    const fromLink = parseHierarchyFromSearchParams(params, {
      allowedRegions: ["Central"],
    });
    expect(serializeHierarchy(fromLink)).toEqual(serializeHierarchy(hierarchy));
    expect(
      filterNeedsStaffing(rows, fromLink)
        .map((r) => r.roundId)
        .sort()
    ).toEqual([1, 5]);
  });

  it("does not treat a lead assignment as staffed — only teamAssignedAt counts", () => {
    const queues = buildOverviewQueues(
      [row({ roundId: 1, status: "upcoming", teamAssignedAt: null })],
      today
    );
    expect(queues.find((q) => q.id === "needs-staffing")?.count).toBe(1);
  });

  it("optionally counts one job even when two rounds match", () => {
    const queues = buildOverviewQueues(
      [
        row({ roundId: 1, jobId: 10, status: "post_bid" }),
        row({ roundId: 2, jobId: 10, status: "post_bid" }),
      ],
      today,
      undefined,
      { uniqueJobs: true }
    );
    expect(queues.find((q) => q.id === "awaiting-lock")?.count).toBe(1);
  });

  it("adds a lead-owed post-bid queue without replacing the five company queues", () => {
    const queues = buildOverviewQueues(
      [
        row({
          roundId: 1,
          status: "submitted",
          estimateLeadId: 9,
        }),
        row({
          roundId: 2,
          status: "post_bid",
          estimateLeadId: 8,
        }),
      ],
      today,
      undefined,
      { owedLeadId: 9 }
    );
    expect(queues.map((q) => q.id)).toContain("you-owe-post-bid");
    expect(queues.find((q) => q.id === "you-owe-post-bid")?.count).toBe(1);
    expect(queues.find((q) => q.id === "you-owe-post-bid")?.href).toBe(
      "/post-bid?mine=1"
    );
  });
});
