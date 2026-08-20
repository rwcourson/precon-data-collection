import { describe, expect, it } from "vitest";
import {
  applySalesforceLinkPlan,
  applySalesforceUnlinkPlan,
  assertSalesforceJobNumberAvailable,
  planSalesforceLink,
  planSalesforceUnlink,
  typeOverSalesforceSuggestion,
} from "./salesforce-link";

const rom = {
  id: 8,
  jobNumber: "TBD-1008",
  jobName: "Riverside Medical ROM",
  salesforceId: null,
  isLinked: false,
};

const sf = {
  sfId: "SF-88",
  jobNumber: "2600888",
  jobName: "Riverside Medical Tower",
  region: "Central",
  marketSector: "Healthcare – Acute",
  city: "Nashville",
  state: "TN",
};

describe("suggestion-first Salesforce linking", () => {
  it("accepts a match without dropping rounds and stores source shadow values", () => {
    const plan = planSalesforceLink(rom, sf, [11, 12]);
    expect(plan.patch.jobNumber).toBe("2600888");
    expect(plan.patch.salesforceShadow).toMatchObject({
      jobName: "Riverside Medical Tower",
      region: "Central",
      city: "Nashville",
    });
    const next = applySalesforceLinkPlan(
      {
        job: rom,
        rounds: [
          { id: 11, estimatePhase: "ROM" },
          { id: 12, estimatePhase: "GMP" },
        ],
      },
      plan
    );
    expect(next.rounds.map((round) => round.id)).toEqual([11, 12]);
    expect(next.job.isLinked).toBe(true);
  });

  it("breaks a typed-over suggestion and keeps an undo handle", () => {
    const accepted = typeOverSalesforceSuggestion(sf);
    expect(accepted.selected).toBeNull();
    expect(accepted.undo?.sfId).toBe("SF-88");
    const restored = typeOverSalesforceSuggestion(null);
    expect(restored.undo).toBeNull();
  });

  it("unlinks with an undo path and keeps local rounds", () => {
    const linked = applySalesforceLinkPlan(
      { job: rom, rounds: [{ id: 11, estimatePhase: "ROM" }] },
      planSalesforceLink(rom, sf, [11])
    );
    const unlink = planSalesforceUnlink(linked.job);
    expect(unlink.undo.salesforceId).toBe("SF-88");
    const cleared = applySalesforceUnlinkPlan(linked, unlink);
    expect(cleared.job.isLinked).toBe(false);
    expect(cleared.rounds).toHaveLength(1);
  });

  it("rejects a duplicate Salesforce job number on another job", () => {
    expect(() =>
      assertSalesforceJobNumberAvailable(
        "2600888",
        [
          { id: 8, jobNumber: "TBD-1008" },
          { id: 9, jobNumber: "2600888" },
        ],
        8
      )
    ).toThrow(/already in use/);
  });

  it("does not treat the current job as a duplicate of itself", () => {
    expect(() =>
      assertSalesforceJobNumberAvailable(
        "2600888",
        [{ id: 8, jobNumber: "2600888" }],
        8
      )
    ).not.toThrow();
  });
});
