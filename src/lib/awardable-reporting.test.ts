import { describe, expect, it } from "vitest";
import frozenPacket from "../../fixtures/roundtable-locked-frozen.json";
import {
  AWARDABLE_REPORTING_GRAIN,
  type AwardableReportingRow,
  awardableCoverage,
  awardableExportFooter,
  buildAwardableCandidateReport,
  departmentThroughput,
  formatAwardableShadowBrief,
  manHourEfficiency,
  shadowAwardableHitRate,
  shadowAwardableHitRateByLead,
  shadowAwardableHitRateBySector,
  toAwardableReportingRows,
} from "./awardable-reporting";

const frozen = frozenPacket.rows as AwardableReportingRow[];

describe("awardable reporting grain", () => {
  it("uses locked revisions only and states coverage", () => {
    const coverage = awardableCoverage(frozen);
    expect(coverage.locked).toBe(2);
    expect(coverage.withAwardable).toBe(2);
    expect(coverage.coverage).toBe(1);
    expect(coverage.grain).toMatch(/Locked revisions/);
  });

  it("keeps hit rate in shadow and ignores in-flight rows", () => {
    const hit = shadowAwardableHitRate(frozen);
    expect(hit.attempts).toBe(2);
    expect(hit.wins).toBe(1);
    expect(hit.rate).toBe(0.5);
    expect(hit.provisional).toBe(true);
    const throughput = departmentThroughput(frozen);
    expect(throughput).toHaveLength(1);
    expect(throughput[0]?.awardableDollars).toBe(52_000_000);
  });

  it("reconciles Overview, Magnus, and warehouse candidate numbers on the same locked grain", () => {
    const locked = frozen.filter((row) => row.status === "locked");
    const coverage = awardableCoverage(frozen);
    const hit = shadowAwardableHitRate(frozen);
    expect(locked.map((row) => row.roundId)).toEqual([1, 2]);
    expect(coverage.locked).toBe(locked.length);
    expect(hit.attempts).toBe(locked.length);
    expect(coverage.grain).toBe(AWARDABLE_REPORTING_GRAIN.coverage);
    expect(hit.grain).toBe(AWARDABLE_REPORTING_GRAIN.hitRate);
    expect(AWARDABLE_REPORTING_GRAIN.coverage).toMatch(/^Locked revisions/);
  });

  it("uses the same locked grain string Magnus and Overview would print", () => {
    const coverage = awardableCoverage(frozen);
    const hit = shadowAwardableHitRate(frozen);
    expect(`${coverage.locked} locked · ${coverage.grain}`).toMatch(
      /Locked revisions only/
    );
    expect(`${hit.wins} of ${hit.attempts} · ${hit.grain}`).toMatch(
      /locked awardable/
    );
    expect(shadowAwardableHitRateBySector(frozen)[0]?.grain).toBe(
      AWARDABLE_REPORTING_GRAIN.hitRateBySector
    );
    expect(
      shadowAwardableHitRateByLead(frozen)
        .map((row) => row.lead)
        .sort()
    ).toEqual(["Jay McDaniel", "Marcus Webb"]);
  });

  it("appends grain copy to exports that include awardable columns", () => {
    expect(awardableExportFooter(["jobName", "bidDueDate"])).toBeNull();
    expect(awardableExportFooter(["awardableAmount"])).toBe(
      AWARDABLE_REPORTING_GRAIN.coverage
    );
    expect(awardableExportFooter(["sum:awardableAmount"])).toBe(
      AWARDABLE_REPORTING_GRAIN.coverage
    );
  });

  it("prints the same Overview / Magnus / Power BI candidate packet from the frozen fixture", () => {
    expect(frozenPacket.id).toBe("roundtable-locked-frozen-v1");
    expect(frozenPacket.grain).toEqual(AWARDABLE_REPORTING_GRAIN);
    const packet = buildAwardableCandidateReport(frozen);
    const brief = formatAwardableShadowBrief(frozen);
    expect(packet.lockedRowCount).toBe(2);
    expect(packet.inFlightIgnored).toBe(1);
    expect(packet.productionHitRateUnchanged).toBe(true);
    expect(packet.coverage.locked).toBe(2);
    expect(packet.hitRate.attempts).toBe(2);
    expect(packet.hitRate.wins).toBe(1);
    expect(packet.hitRateBySector).toEqual([
      expect.objectContaining({
        sector: "Healthcare – Acute",
        attempts: 2,
        wins: 1,
        rate: 0.5,
      }),
    ]);
    expect(packet.hitRateByLead).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lead: "Marcus Webb",
          attempts: 1,
          wins: 1,
          rate: 1,
        }),
        expect.objectContaining({
          lead: "Jay McDaniel",
          attempts: 1,
          wins: 0,
          rate: 0,
        }),
      ])
    );
    expect(packet.throughput[0]?.awardableDollars).toBe(52_000_000);
    expect(brief.coverageLine).toMatch(/100%/);
    expect(brief.hitRateLine).toMatch(/provisional/);
    expect(brief.grain).toBe(AWARDABLE_REPORTING_GRAIN);
  });

  it("does not infer awardable amount from estimate value", () => {
    const inferred = frozen.map((row) => ({
      ...row,
      awardableAmount: null,
    }));
    const coverage = awardableCoverage(inferred);
    expect(coverage.withAwardable).toBe(0);
    expect(coverage.locked).toBe(2);
    expect(shadowAwardableHitRate(inferred).attempts).toBe(0);
  });

  it("drops N/A craft labor hours from efficiency denominators", () => {
    const rows = toAwardableReportingRows(
      [
        {
          id: 9,
          status: "locked",
          outcome: "successful",
          region: "Central",
          preconDepartment: "Central Building Group",
          marketSector: "Healthcare – Acute",
          contractType: "GC - Lump Sum",
          bidYear: 2026,
          estimateValue: 12_000_000,
          awardableAmount: 12_000_000,
          contractAmountSigned: null,
          craftLaborManHours: 1200,
          selfPerformProposed: null,
        },
      ],
      new Map([[9, new Set(["craftLaborManHours"])]])
    );
    expect(rows[0]?.craftLaborManHours).toBeNull();
    expect(manHourEfficiency(rows)[0]?.dollarsPerHour).toBeNull();
  });
});
