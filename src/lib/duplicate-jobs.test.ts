import { describe, expect, it } from "vitest";
import {
  DUPLICATE_SCORE_THRESHOLD,
  findDuplicateJobs,
  normalizeJobName,
  scoreDuplicateJob,
} from "./duplicate-jobs";

describe("duplicate job scoring", () => {
  it("expands Perf/Ctr abbreviations so Auburn names collide", () => {
    expect(normalizeJobName("Auburn Football Perf. Ctr")).toBe(
      "auburn football performance center"
    );
    expect(normalizeJobName("Auburn Football Performance Center")).toBe(
      "auburn football performance center"
    );
  });

  it("surfaces Auburn Football Performance Center vs Auburn Football Perf Ctr above threshold", () => {
    const match = scoreDuplicateJob(
      {
        jobName: "Auburn Football Performance Center",
        city: "Auburn",
        state: "AL",
      },
      {
        jobId: 9,
        jobName: "Auburn Football Perf. Ctr",
        jobNumber: "TBD-1042",
        homeRegion: "Georgia",
        creatorName: "Sarah Chen",
        lastActivityAt: "2026-08-01T00:00:00.000Z",
        city: "Auburn",
        state: "AL",
      }
    );
    expect(match.score).toBeGreaterThanOrEqual(DUPLICATE_SCORE_THRESHOLD);
    expect(match.homeRegion).toBe("Georgia");
    expect(match.signals.cityMatch).toBe(true);
    expect(match.signals.stateMatch).toBe(true);
  });

  it("does not warn on unrelated names", () => {
    const matches = findDuplicateJobs({ jobName: "Riverside Quick ROM" }, [
      {
        jobId: 1,
        jobName: "Birmingham Regional Medical Center Tower",
        jobNumber: "24101",
        homeRegion: "Central",
        creatorName: null,
        lastActivityAt: null,
      },
    ]);
    expect(matches).toEqual([]);
  });
});
