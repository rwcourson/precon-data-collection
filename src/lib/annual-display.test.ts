/**
 * Tests shipped annual-display mappers against real computeStats() RollupStats
 * (rounds + volume). Proves wrong count/totalValue fields would mis-render.
 */
import { describe, expect, it } from "vitest";
import type { EstimateRound } from "@/db/schema";
import {
  formatDollars,
  formatRoundsBadge,
  formatRoundsVolumeLine,
  roundsFromStats,
  volumeFromStats,
} from "@/lib/annual-display";
import { computeStats } from "@/lib/rollup";

function stubRound(partial: Partial<EstimateRound>): EstimateRound {
  return {
    id: 1,
    jobId: 1,
    roundNumber: 1,
    status: "locked",
    outcome: "pending",
    region: "Central",
    preconDepartment: "Central Heavy Civil",
    estimatePhase: "GMP",
    bidYear: 2026,
    bidDueDate: null,
    city: null,
    state: null,
    marketSector: null,
    mlt: null,
    contractType: null,
    procurement: null,
    statusAtPricing: null,
    estimateValue: null,
    estimateLeadId: null,
    createdById: null,
    lockedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    ...partial,
  } as EstimateRound;
}

describe("annual-display (shipped) vs RollupStats", () => {
  it("reads rounds and volume from computeStats output", () => {
    const stats = computeStats("all", [
      stubRound({ id: 1, estimateValue: 10_000_000 }),
      stubRound({ id: 2, estimateValue: 5_000_000 }),
    ]);
    expect(roundsFromStats(stats)).toBe(2);
    expect(volumeFromStats(stats)).toBe(15_000_000);
    expect(formatRoundsBadge(stats)).toBe("2 rounds");
    expect(formatRoundsVolumeLine(stats)).toBe(
      `2 rounds · ${formatDollars(15_000_000)}`
    );
  });

  it("prefers rounds/volume over legacy count/totalValue", () => {
    expect(roundsFromStats({ rounds: 405, count: 0 })).toBe(405);
    expect(volumeFromStats({ volume: 31_006_472_747.86, totalValue: 0 })).toBe(
      31_006_472_747.86
    );
    const line = formatRoundsVolumeLine({
      rounds: 405,
      volume: 31_006_472_747.86,
    });
    expect(line.startsWith("405 rounds · $")).toBe(true);
    // Legacy-only wrong shape (what the bug used) shows empty metrics
    expect(
      formatRoundsVolumeLine({ count: undefined, totalValue: undefined })
    ).toBe("0 rounds · —");
  });

  it("formats live overall-shaped payload correctly", () => {
    const overall = computeStats("all", [
      stubRound({ id: 1, estimateValue: 100 }),
      stubRound({ id: 2, estimateValue: 200 }),
      stubRound({ id: 3, estimateValue: 300 }),
    ]);
    // Same keys the annual API puts on overall
    expect(overall).toMatchObject({ rounds: 3, volume: 600 });
    expect(formatRoundsVolumeLine(overall)).toBe(
      `3 rounds · ${formatDollars(600)}`
    );
  });
});
