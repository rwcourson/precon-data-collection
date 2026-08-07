import { describe, expect, it } from "vitest";
import { nameScore, proposeMatches, scorePair } from "./salesforce-match";

describe("salesforce match", () => {
  it("scores exact name+region highly", () => {
    const c = scorePair(
      {
        id: 1,
        jobNumber: "TBD-1",
        jobName: "Chambliss King School",
        region: "Central",
        isLinked: false,
        salesforceId: null,
        estimateValue: 10_000_000,
      },
      {
        sfId: "SF-1",
        jobNumber: "2600123",
        jobName: "Chambliss King School",
        region: "Central",
        expectedValue: 10_500_000,
        sourceVersion: "v1",
      },
    );
    expect(c.score).toBeGreaterThan(0.7);
    expect(c.signals.regionMatch).toBe(true);
    expect(c.signals.nameScore).toBeGreaterThan(0.9);
  });

  it("flags job number discrepancy without auto-overwrite signal", () => {
    const c = scorePair(
      {
        id: 2,
        jobNumber: "2500999",
        jobName: "River Hospital Phase 2",
        region: "Central",
        isLinked: true,
        salesforceId: "SF-OLD",
        estimateValue: null,
      },
      {
        sfId: "SF-2",
        jobNumber: "2600888",
        jobName: "River Hospital Phase 2",
        region: "Central",
        sourceVersion: "v2",
      },
    );
    expect(c.discrepancy).toContain("job_number_mismatch");
  });

  it("respects suppressions and skips already-linked sfId", () => {
    const jobs = [
      {
        id: 1,
        jobNumber: "TBD-1",
        jobName: "Alpha Project",
        region: "Central",
        isLinked: false,
        salesforceId: null,
      },
      {
        id: 2,
        jobNumber: "2600001",
        jobName: "Beta Project",
        region: "Central",
        isLinked: true,
        salesforceId: "SF-B",
      },
    ];
    const opps = [
      {
        sfId: "SF-A",
        jobNumber: "2600111",
        jobName: "Alpha Project",
        region: "Central",
        sourceVersion: "v1",
      },
      {
        sfId: "SF-B",
        jobNumber: "2600001",
        jobName: "Beta Project",
        region: "Central",
        sourceVersion: "v1",
      },
    ];
    const suppressed = [{ jobId: 1, sfId: "SF-A", sourceVersion: "v1" }];
    // Threshold above weak cross-matches (shared "Project" token + region ≈ 0.43).
    const candidates = proposeMatches(jobs, opps, suppressed, 0.5);
    expect(candidates.find((c) => c.sfId === "SF-A")).toBeUndefined();
    expect(candidates.find((c) => c.sfId === "SF-B")).toBeUndefined();
  });

  it("nameScore is symmetric-ish for shared tokens", () => {
    expect(nameScore("King High School", "King School")).toBeGreaterThan(0.4);
  });
});
