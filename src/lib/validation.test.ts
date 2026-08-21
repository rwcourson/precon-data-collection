import { describe, expect, it } from "vitest";
import type { EstimateRound } from "@/db/schema";
import { REQUIRED_FIELD_KEYS } from "./fields";
import {
  evaluateLockGate,
  isRealCalendarDate,
  missingRequiredFields,
  validateFieldValue,
} from "./validation";

function sparseRound(): EstimateRound {
  return {
    id: 1,
    jobId: 1,
    roundNumber: 1,
    status: "post_bid",
    outcome: "pending",
    region: "Central",
    preconDepartment: "Central Building Group",
    estimatePhase: "GMP",
    bidYear: 2026,
    bidDueDate: "2026-04-15",
    drawingsDueDate: "2026-03-15",
    bidReviewDate: "2026-04-01",
    interviewDate: null,
    projectStartDate: "2026-06-01",
    projectStartMonth: "2026-06",
    owner: "HCA Healthcare",
    city: "Nashville",
    state: "TN",
    estimateLeadId: 2,
    teamAssignedAt: null,
    teamAssignedById: null,
    mlt: "Healthcare",
    marketSector: "Healthcare – Acute",
    contractType: "GC - Lump Sum",
    procurement: "Negotiated",
    designContract: "Design-Bid-Build",
    statusAtPricing: "Prospective",
    internalJointVenture: "None",
    awardability: "Not Work Under Contract – Budget",
    businessStrategyValues: null,
    estimateValue: 42_000_000,
    awardableAmount: null,
    contractAmountSigned: null,
    feeBackPage: null,
    feeExpected: null,
    contingencyTotal: null,
    craftLaborBase: null,
    craftLaborBurden: null,
    craftLaborManHours: null,
    gcBgSort: null,
    grBgSort: null,
    gcProposedOwnerSov: null,
    grProposedOwnerSov: null,
    pmMonths: null,
    fieldSupervisionMonths: null,
    preconCost: null,
    designCost: null,
    selfPerformPriced: null,
    selfPerformProposed: null,
    projectScheduleDuration: null,
    projectPlanningPreconEngagement: null,
    gsf: null,
    hotelKeysUnits: null,
    materials: null,
    supplies: null,
    equipment: null,
    equipmentOperation: null,
    subcontracted: null,
    marketOrStrategicRates: null,
    subQuotesReceived: null,
    mwdbeSubQuotesReceived: null,
    mwdbeSubsPlugged: null,
    costOfWorkBasis: null,
    afmMonths: null,
    peakManpowerHeadcount: null,
    submittedAt: new Date(),
    lockedAt: null,
    createdById: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    deletionBatchId: null,
  };
}

describe("lock gate labels", () => {
  it("blocks lock on blank required fields and names the labels leadership uses", () => {
    const extras = {
      jobNumber: "24150",
      jobName: "St. Thomas Midtown Expansion",
      estimateLeadName: "Jay McDaniels",
    };
    const missing = missingRequiredFields(sparseRound(), {}, extras);
    expect(missing).toContain("Fee – Expected $");
    expect(missing).toContain("Fee – Back Page $");
    expect(missing).not.toContain("Owner");
    expect(missing).not.toContain("Drawings Due");
    expect(REQUIRED_FIELD_KEYS).not.toContain("owner");
    expect(REQUIRED_FIELD_KEYS).not.toContain("spoilDisposalSite");

    const gate = evaluateLockGate(sparseRound(), {}, extras);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.missingFields).toContain("Fee – Expected $");
      expect(gate.error).toMatch(/Cannot lock/);
      expect(gate.error).toMatch(/Fee – Expected \$/);
    }
  });
});

describe("date field validation", () => {
  it("rejects regex-shaped but impossible dates", () => {
    expect(isRealCalendarDate("2026-13-45")).toBe(false);
    expect(isRealCalendarDate("2026-02-30")).toBe(false);
    expect(isRealCalendarDate("2026-04-31")).toBe(false);
    expect(isRealCalendarDate("2026-02-28")).toBe(true);
    expect(isRealCalendarDate("2024-02-29")).toBe(true); // leap year

    expect(validateFieldValue("bidDueDate", "2026-13-45", {}).ok).toBe(false);
    expect(validateFieldValue("bidDueDate", "2026-02-30", {}).ok).toBe(false);
    expect(validateFieldValue("bidDueDate", "2026-04-15", {})).toEqual({
      ok: true,
      value: "2026-04-15",
    });
  });

  it("allows clearing a dropdown back to empty", () => {
    expect(validateFieldValue("awardability", "", {})).toEqual({
      ok: true,
      value: null,
    });
  });
});
