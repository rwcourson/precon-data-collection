import { describe, expect, it } from "vitest";
import type { CustomColumn } from "@/db/schema";
import {
  regionCustomTabForRound,
  regionCustomTabTitle,
  regionScopedColumnsForRound,
} from "./region-custom-columns";
import { postBidQueueRow } from "./post-bid-queue";
import type { EstimateRound } from "@/db/schema";

function column(partial: Partial<CustomColumn> & Pick<CustomColumn, "id" | "key" | "label" | "scope">): CustomColumn {
  return {
    region: null,
    preconDepartment: null,
    type: "text",
    options: null,
    createdById: 1,
    createdAt: new Date(),
    ...partial,
  };
}

describe("region custom tab", () => {
  const centralIndustrial = column({
    id: 1,
    key: "spoilDisposalSite",
    label: "Spoil Disposal Site (demo)",
    scope: "region",
    region: "Central",
    preconDepartment: "Central Heavy Civil",
  });
  const georgiaClean = column({
    id: 2,
    key: "cleanRoomClass",
    label: "Clean Room Class",
    scope: "region",
    region: "Georgia",
    preconDepartment: "Georgia – Mission Critical & Industrial",
  });
  const company = column({
    id: 3,
    key: "lessons",
    label: "Lessons learned",
    scope: "company",
  });

  it("titles Central Heavy Civil as Central — Heavy Civil", () => {
    expect(regionCustomTabTitle("Central", "Central Heavy Civil")).toBe("Central — Heavy Civil");
  });

  it("shows the Central tab on a Central Heavy Civil round and not on a Georgia round", () => {
    const cols = [centralIndustrial, georgiaClean, company];
    const central = regionCustomTabForRound(cols, {
      region: "Central",
      preconDepartment: "Central Heavy Civil",
    });
    expect(central).toBeTruthy();
    expect(central?.title).toBe("Central — Heavy Civil");
    expect(central?.columns.map((c) => c.key)).toEqual(["spoilDisposalSite"]);

    const georgia = regionCustomTabForRound(cols, {
      region: "Georgia",
      preconDepartment: "Georgia – Mission Critical & Industrial",
    });
    expect(georgia?.title).not.toMatch(/Central/);
    expect(georgia?.columns.map((c) => c.key)).toEqual(["cleanRoomClass"]);

    const georgiaCommercial = regionCustomTabForRound(cols, {
      region: "Georgia",
      preconDepartment: "Georgia – Commercial",
    });
    expect(georgiaCommercial).toBeNull();
  });

  it("does not mix company-scope columns into the region tab", () => {
    const cols = regionScopedColumnsForRound(
      [centralIndustrial, company],
      { region: "Central", preconDepartment: "Central Heavy Civil" },
    );
    expect(cols.every((c) => c.scope === "region")).toBe(true);
  });
});

describe("post-bid queue row", () => {
  const extras = {
    jobNumber: "24150",
    jobName: "St. Thomas Midtown Expansion",
    estimateLeadName: "Jay McDaniels",
  };

  it("names missing required fields for awaiting-required-fields", () => {
    const round = {
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
      projectStartDate: "2026-06-01",
      owner: "HCA",
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
    } as EstimateRound;
    const row = postBidQueueRow(round, {}, extras);
    expect(row.state).toBe("awaiting-required-fields");
    expect(row.missing).toContain("Fee – Expected $");
    expect(row.missing).not.toContain("Spoil Disposal Site (demo)");
  });
});
