import { describe, expect, it } from "vitest";
import { buildOverviewQueues, calendarDate, type OverviewQueueInput } from "./overview-queues";

function row(partial: Partial<OverviewQueueInput> & Pick<OverviewQueueInput, "roundId">): OverviewQueueInput {
  return {
    jobId: partial.roundId,
    jobNumber: `J-${partial.roundId}`,
    jobName: `Job ${partial.roundId}`,
    status: "active",
    bidDueDate: null,
    isLinked: true,
    missingRequiredCount: 0,
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
        row({ roundId: 6, status: "upcoming", isLinked: false, jobNumber: "TBD-0042" }),
        row({ roundId: 7, status: "locked", missingRequiredCount: 0 }),
      ],
      today,
    );

    expect(queues.map((q) => [q.id, q.count])).toEqual([
      ["incomplete-post-bid", 2],
      ["past-bid-due", 1],
      ["unlinked", 1],
      ["awaiting-lock", 2],
    ]);
    expect(queues[0]?.href).toBe("/post-bid?queue=incomplete");
    expect(queues[1]?.href).toBe("/bid-schedule?section=active&queue=past-due");
    expect(queues[2]?.href).toBe("/bid-schedule?queue=unlinked");
    expect(queues[3]?.href).toBe("/post-bid?queue=awaiting-lock");
  });

  it("does not treat blank bid due as past due", () => {
    const queues = buildOverviewQueues(
      [row({ roundId: 1, status: "active", bidDueDate: null })],
      today,
    );
    expect(queues.find((q) => q.id === "past-bid-due")?.count).toBe(0);
  });
});
