import { describe, expect, it } from "vitest";
import type { EstimateRound } from "@/db/schema";
import {
  estimatePhaseBand,
  FIELD_DEFS,
  FIELD_POLICY_VERSION,
  fieldsForRoundEntry,
  isFieldRequired,
  requiredFieldKeysFor,
} from "./fields";
import { calcMetric, METRIC_MAP } from "./metrics";
import {
  applicableExceptionKeys,
  evaluateLockGate,
  legacyZeroFieldLabels,
  missingRequiredFields,
} from "./validation";

function round(
  partial: Partial<EstimateRound> & Pick<EstimateRound, "estimatePhase">
): EstimateRound {
  return {
    id: 1,
    jobId: 1,
    roundNumber: 1,
    status: "post_bid",
    outcome: "pending",
    region: "Central",
    preconDepartment: "Central Building Group",
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
    feeBackPage: 1_000_000,
    feeExpected: 1_100_000,
    contingencyTotal: 500_000,
    craftLaborBase: 1,
    craftLaborBurden: 1,
    craftLaborManHours: 1200,
    gcBgSort: null,
    grBgSort: null,
    gcProposedOwnerSov: null,
    grProposedOwnerSov: null,
    pmMonths: 12,
    fieldSupervisionMonths: 12,
    preconCost: null,
    designCost: 1,
    selfPerformPriced: 1,
    selfPerformProposed: 1,
    projectScheduleDuration: 18,
    projectPlanningPreconEngagement: "6",
    gsf: 1,
    hotelKeysUnits: null,
    materials: 1,
    supplies: 1,
    equipment: 1,
    equipmentOperation: 1,
    subcontracted: 1,
    marketOrStrategicRates: null,
    subQuotesReceived: 1,
    mwdbeSubQuotesReceived: 1,
    mwdbeSubsPlugged: 1,
    costOfWorkBasis: null,
    afmMonths: 1,
    peakManpowerHeadcount: 1,
    submittedAt: new Date(),
    lockedAt: null,
    createdById: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    deletionBatchId: null,
    ...partial,
  };
}

const extras = {
  jobNumber: "24150",
  jobName: "St. Thomas Midtown Expansion",
  estimateLeadName: "Jay McDaniels",
};

describe("versioned field policy", () => {
  it("classifies concept, design, and commitment bands without treating every Budget phase as concept", () => {
    expect(estimatePhaseBand("Budget - Quick ROM")).toBe("concept");
    expect(estimatePhaseBand("Budget - Concept")).toBe("concept");
    expect(estimatePhaseBand("Budget - DD")).toBe("design");
    expect(estimatePhaseBand("GMP")).toBe("commitment");
    expect(FIELD_POLICY_VERSION).toBe(1);
  });

  it("does not require craft hours on a concept ROM", () => {
    const keys = requiredFieldKeysFor(
      {
        estimatePhase: "Budget - Quick ROM",
        awardability: "Not Work Under Contract – Budget",
      },
      { fieldPolicy: true }
    );
    expect(keys).not.toContain("craftLaborManHours");
    expect(keys).toContain("estimateValue");
  });

  it("rejects zero craft hours on a GMP lock", () => {
    const missing = missingRequiredFields(
      round({ estimatePhase: "GMP", craftLaborManHours: 0 }),
      { selfPerformWorkType: ["Concrete"] },
      extras,
      {},
      { fieldPolicy: true }
    );
    expect(missing).toContain("Craft Labor Man Hours");
  });

  it("honors an explicit N/A exception", () => {
    const missing = missingRequiredFields(
      round({ estimatePhase: "GMP", craftLaborManHours: null }),
      { selfPerformWorkType: ["Concrete"] },
      extras,
      { notApplicable: new Set(["craftLaborManHours"]) },
      { fieldPolicy: true }
    );
    expect(missing).not.toContain("Craft Labor Man Hours");
  });

  it("excludes N/A hours from metric numerators and denominators", () => {
    const gmp = round({
      estimatePhase: "GMP",
      craftLaborManHours: 1200,
      estimateValue: 12_000_000,
    });
    const na = new Set(["craftLaborManHours"]);
    expect(calcMetric(METRIC_MAP.manHoursPerMillion!, gmp)).toBe(100);
    expect(calcMetric(METRIC_MAP.manHoursPerMillion!, gmp, na)).toBeNull();
    expect(calcMetric(METRIC_MAP.laborCostPerManHour!, gmp)).not.toBeNull();
    expect(calcMetric(METRIC_MAP.laborCostPerManHour!, gmp, na)).toBeNull();
  });

  it("drops N/A once the stored value no longer matches the elected snapshot", () => {
    const snapshots = new Map([["craftLaborManHours", "1200"]]);
    expect(
      applicableExceptionKeys(snapshots, { craftLaborManHours: 1200 }).has(
        "craftLaborManHours"
      )
    ).toBe(true);
    expect(
      applicableExceptionKeys(snapshots, { craftLaborManHours: 2400 }).has(
        "craftLaborManHours"
      )
    ).toBe(false);
  });

  it("keeps a sparse concept round lockable without GMP labor fields", () => {
    const gate = evaluateLockGate(
      round({
        estimatePhase: "Budget - Quick ROM",
        craftLaborManHours: null,
        pmMonths: null,
        fieldSupervisionMonths: null,
      }),
      {},
      extras,
      {},
      { fieldPolicy: true }
    );
    expect(gate.ok).toBe(true);
  });

  it("treats DD as design and Hard Bid as commitment", () => {
    expect(estimatePhaseBand("Budget - DD")).toBe("design");
    expect(estimatePhaseBand("Hard Bid")).toBe("commitment");
    const dd = requiredFieldKeysFor(
      {
        estimatePhase: "Budget - DD",
        awardability: "Work Under Contract",
      },
      { fieldPolicy: true }
    );
    expect(dd).toContain("craftLaborManHours");
    const nonAwardable = requiredFieldKeysFor(
      {
        estimatePhase: "Budget - DD",
        awardability: "Not Awardable",
      },
      { fieldPolicy: true }
    );
    expect(nonAwardable).not.toContain("craftLaborManHours");
    const gmpAwardable = requiredFieldKeysFor(
      {
        estimatePhase: "GMP",
        awardability: "Work Under Contract",
      },
      { fieldPolicy: true }
    );
    expect(gmpAwardable).toContain("craftLaborManHours");
  });

  it("keeps GC/GR Owner SOV, B&G sort, precon cost, and support services off the lock gate", () => {
    const keys = requiredFieldKeysFor(
      {
        estimatePhase: "GMP",
        awardability: "Work Under Contract",
      },
      { fieldPolicy: true }
    );
    expect(keys).not.toContain("gcProposedOwnerSov");
    expect(keys).not.toContain("grProposedOwnerSov");
    expect(keys).not.toContain("gcBgSort");
    expect(keys).not.toContain("grBgSort");
    expect(keys).not.toContain("preconCost");
    expect(keys).not.toContain("utilizedSupportServices");
  });

  it("requires range acknowledgement and preserves legacy zeros when policy is off", () => {
    expect(
      missingRequiredFields(
        round({ estimatePhase: "GMP", craftLaborManHours: 0.5 }),
        { selfPerformWorkType: ["Concrete"] },
        extras,
        {},
        { fieldPolicy: true }
      )
    ).toContain("Craft Labor Man Hours");
    expect(
      missingRequiredFields(
        round({ estimatePhase: "GMP", craftLaborManHours: 0.5 }),
        { selfPerformWorkType: ["Concrete"] },
        extras,
        { rangeAcknowledged: new Set(["craftLaborManHours"]) },
        { fieldPolicy: true }
      )
    ).not.toContain("Craft Labor Man Hours");
    expect(
      missingRequiredFields(
        round({ estimatePhase: "GMP", craftLaborManHours: 0 }),
        { selfPerformWorkType: ["Concrete"] },
        extras,
        {},
        { fieldPolicy: false }
      )
    ).not.toContain("Craft Labor Man Hours");
    expect(
      legacyZeroFieldLabels(
        round({ estimatePhase: "GMP", craftLaborManHours: 0 })
      )
    ).toEqual(["Craft Labor Man Hours"]);
  });

  it("derives MLT from market sector and does not require both", () => {
    const keys = requiredFieldKeysFor(
      {
        estimatePhase: "GMP",
        awardability: "Work Under Contract",
      },
      { fieldPolicy: true }
    );
    expect(keys).toContain("marketSector");
    expect(keys).not.toContain("mlt");
  });

  it("hides the legacy IJV dropdown when organization groups replace it", () => {
    const keys = fieldsForRoundEntry({
      mode: "schedule",
      hideIjvDropdown: true,
    }).map((def) => def.key);
    expect(keys).not.toContain("internalJointVenture");
    expect(keys).toContain("marketSector");
    expect(
      fieldsForRoundEntry({ mode: "postBid", hideIjvDropdown: true }).map(
        (def) => def.key
      )
    ).not.toContain("internalJointVenture");
  });

  it("limits schedule mode to the core set plus self-perform intent", () => {
    const schedule = fieldsForRoundEntry({ mode: "schedule" }).map(
      (def) => def.key
    );
    expect(schedule).toEqual(
      expect.arrayContaining([
        "jobNumber",
        "preconDepartment",
        "estimatePhase",
        "estimateLead",
        "awardability",
        "marketSector",
        "projectStartMonth",
        "projectScheduleDuration",
        "drawingsDueDate",
        "interviewDate",
        "bidDueDate",
        "selfPerformIntent",
      ])
    );
    expect(schedule).not.toContain("craftLaborManHours");
    expect(schedule).not.toContain("feeBackPage");
    expect(schedule).not.toContain("bidReviewDate");
    const postBid = fieldsForRoundEntry({ mode: "postBid" }).map(
      (def) => def.key
    );
    expect(postBid.length).toBeGreaterThan(schedule.length);
    expect(postBid).toContain("feeBackPage");
    const craftHours = FIELD_DEFS.find(
      (def) => def.key === "craftLaborManHours"
    );
    expect(craftHours).toBeDefined();
    expect(
      isFieldRequired(
        craftHours!,
        { estimatePhase: "Budget - Quick ROM" },
        { fieldPolicy: true }
      )
    ).toBe(false);
  });

  it("gives every schedule-core field a help note for the touch-safe info button", () => {
    const missing = FIELD_DEFS.filter(
      (def) => def.scheduleCore && !def.note?.trim()
    ).map((def) => def.key);
    expect(missing).toEqual([]);
  });
});
