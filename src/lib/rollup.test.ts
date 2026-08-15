import { describe, expect, it } from "vitest";
import {
  applyLeadershipRoundScope,
  computeStats,
  latestRoundsPerJob,
  parseLeadershipRoundMode,
  scopeRoundsForDashboardExport,
} from "./rollup";

function round(partial: {
  jobId: number;
  roundNumber: number;
  estimatePhase: string;
  status: "upcoming" | "active" | "outstanding" | "submitted" | "post_bid" | "locked";
  estimateValue?: number | null;
}) {
  return {
    jobId: partial.jobId,
    roundNumber: partial.roundNumber,
    estimatePhase: partial.estimatePhase,
    status: partial.status,
    region: "Central",
    preconDepartment: "Central Building Group",
    bidYear: 2026,
    estimateValue: partial.estimateValue ?? 10_000_000,
    outcome: "pending" as const,
    feeExpected: null,
    feeBackPage: null,
    contingencyTotal: null,
    pmMonths: null,
    gcBgSort: null,
    grBgSort: null,
    selfPerformPriced: null,
    selfPerformProposed: null,
    craftLaborManHours: null,
    craftLaborBase: null,
    craftLaborBurden: null,
    gsf: null,
  };
}

describe("latestRoundsPerJob", () => {
  it("keeps the more final phase on the same job and drops the ROM", () => {
    const rom = round({
      jobId: 1,
      roundNumber: 1,
      estimatePhase: "Budget - Quick ROM",
      status: "locked",
      estimateValue: 8_000_000,
    });
    const gmp = round({
      jobId: 1,
      roundNumber: 2,
      estimatePhase: "GMP",
      status: "submitted",
      estimateValue: 12_000_000,
    });
    const other = round({
      jobId: 2,
      roundNumber: 1,
      estimatePhase: "Budget - SD",
      status: "active",
      estimateValue: 5_000_000,
    });
    const latest = latestRoundsPerJob([rom, gmp, other]);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.jobId === 1)?.estimatePhase).toBe("GMP");
    expect(latest.find((r) => r.jobId === 2)?.estimatePhase).toBe("Budget - SD");
  });

  it("defaults leadership scope to one row per job so volume is not doubled", () => {
    const rows = [
      round({ jobId: 9, roundNumber: 1, estimatePhase: "Budget - SD", status: "locked", estimateValue: 10_000_000 }),
      round({ jobId: 9, roundNumber: 2, estimatePhase: "GMP", status: "locked", estimateValue: 12_000_000 }),
    ];
    const latestStats = computeStats("all", applyLeadershipRoundScope(rows, "latest") as never);
    const allStats = computeStats("all", applyLeadershipRoundScope(rows, "all") as never);
    expect(latestStats.rounds).toBe(1);
    expect(latestStats.volume).toBe(12_000_000);
    expect(allStats.rounds).toBe(2);
    expect(allStats.volume).toBe(22_000_000);
  });

  it("treats missing or unknown rounds param as latest", () => {
    expect(parseLeadershipRoundMode(undefined)).toBe("latest");
    expect(parseLeadershipRoundMode("latest")).toBe("latest");
    expect(parseLeadershipRoundMode("all")).toBe("all");
  });
});

describe("scopeRoundsForDashboardExport (Excel + page)", () => {
  it("defaults the export path to one latest round per job", () => {
    const rows = [
      round({ jobId: 3, roundNumber: 1, estimatePhase: "Budget - SD", status: "locked", estimateValue: 10_000_000 }),
      round({ jobId: 3, roundNumber: 2, estimatePhase: "GMP", status: "locked", estimateValue: 12_000_000 }),
    ];
    const latest = scopeRoundsForDashboardExport(rows, {});
    const all = scopeRoundsForDashboardExport(rows, { rounds: "all" });
    expect(computeStats("all", latest as never).rounds).toBe(1);
    expect(computeStats("all", latest as never).volume).toBe(12_000_000);
    expect(computeStats("all", all as never).rounds).toBe(2);
    expect(computeStats("all", all as never).volume).toBe(22_000_000);
  });

  it("applies sector/phase/status the same way the page and Excel query string do", () => {
    const rows = [
      {
        ...round({ jobId: 1, roundNumber: 1, estimatePhase: "GMP", status: "locked", estimateValue: 10_000_000 }),
        marketSector: "Healthcare – Hospital",
      },
      {
        ...round({ jobId: 2, roundNumber: 1, estimatePhase: "Budget - SD", status: "active", estimateValue: 4_000_000 }),
        marketSector: "Commercial – Office",
      },
    ];
    const scoped = scopeRoundsForDashboardExport(rows, {
      sector: "Healthcare – Hospital",
      phase: "GMP",
      status: "locked",
    });
    expect(scoped).toHaveLength(1);
    expect(scoped[0]!.jobId).toBe(1);
  });
});
