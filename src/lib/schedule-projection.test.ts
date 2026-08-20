import { describe, expect, it } from "vitest";
import {
  compactFlatScheduleRows,
  excludeChildJobRows,
  projectScheduleJobs,
} from "./schedule-projection";

const row = (
  jobId: number,
  id: number,
  status: "active" | "upcoming" | "outstanding",
  due: string | null,
  roundNumber = 1
) => ({
  job: { id: jobId },
  round: { id, status, bidDueDate: due, roundNumber },
});

describe("canonical schedule projection", () => {
  it("returns one row per job and keeps every effort", () => {
    const rows = [
      row(1, 11, "upcoming", "2026-09-01"),
      row(1, 12, "active", "2026-08-25", 2),
      row(2, 21, "active", "2026-08-20"),
    ];
    const result = projectScheduleJobs(rows);
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.jobId === 1)?.focal.round.id).toBe(12);
    expect(result.find((item) => item.jobId === 1)?.efforts).toHaveLength(2);
  });

  it("uses eligible rows for focus and all rows for sibling context", () => {
    const active = row(1, 12, "active", "2026-08-25", 2);
    const upcoming = row(1, 11, "upcoming", "2026-09-01");
    const [result] = projectScheduleJobs([upcoming], [active, upcoming]);
    expect(result.focal.round.id).toBe(11);
    expect(result.efforts.map((effort) => effort.round.id)).toEqual([12, 11]);
  });

  it("compacts export rows to one job and hides nested children", () => {
    const compact = compactFlatScheduleRows([
      {
        jobId: 1,
        status: "upcoming",
        bidDueDate: "2026-09-01",
        roundNumber: 1,
      },
      { jobId: 1, status: "active", bidDueDate: "2026-08-20", roundNumber: 2 },
    ]);
    expect(compact).toHaveLength(1);
    expect(compact[0]?.status).toBe("active");
    expect(
      excludeChildJobRows(
        [
          row(1, 11, "active", "2026-08-20"),
          row(2, 21, "active", "2026-08-21"),
        ],
        [2]
      ).map((item) => item.job.id)
    ).toEqual([1]);
  });

  it("keeps the same job ids for table, cards, and gantt", () => {
    const rows = [
      row(1, 11, "upcoming", "2026-09-01"),
      row(1, 12, "active", "2026-08-25", 2),
      row(2, 21, "active", "2026-08-20"),
    ];
    const projected = projectScheduleJobs(rows);
    const tableIds = projected.map((item) => item.jobId);
    const cardIds = projected.map((item) => item.focal.job.id);
    const ganttIds = projected.map((item) => item.jobId);
    expect(tableIds).toEqual(cardIds);
    expect(cardIds).toEqual(ganttIds);
    expect(new Set(tableIds).size).toBe(tableIds.length);
  });

  it("projects a dump-sized board as one row per job", () => {
    // Isolated dump-vs-live on 2026-08-20: 640 jobs, 1098 rounds.
    const rows = [];
    let roundId = 1;
    for (let jobId = 1; jobId <= 640; jobId++) {
      rows.push(row(jobId, roundId++, "active", "2026-09-01"));
      if (jobId <= 458) {
        rows.push(row(jobId, roundId++, "upcoming", "2026-10-01", 2));
      }
    }
    expect(rows).toHaveLength(1098);
    const started = performance.now();
    const projected = projectScheduleJobs(rows);
    expect(performance.now() - started).toBeLessThan(100);
    expect(projected).toHaveLength(640);
    expect(new Set(projected.map((item) => item.jobId)).size).toBe(640);
    expect(projected.find((item) => item.jobId === 1)?.efforts).toHaveLength(2);
  });
});
