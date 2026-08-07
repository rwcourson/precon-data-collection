import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { REFERENCE_LISTS } from "@/lib/reference-data";
import {
  applySalesforceLinkPlan,
  planSalesforceLink,
  type PursuitHistoryState,
} from "./salesforce-link";

describe("ROM / prospect Salesforce history", () => {
  it("includes Budget – Quick ROM in estimate phase reference data", () => {
    expect(REFERENCE_LISTS.estimatePhase.values).toContain("Budget – Quick ROM");
  });

  it("links a manual unnumbered pursuit without dropping ROM round history", () => {
    const before: PursuitHistoryState = {
      job: {
        id: 42,
        jobNumber: "TBD-4821",
        jobName: "Riverside Medical Tower — Quick ROM",
        salesforceId: null,
        isLinked: false,
      },
      rounds: [
        { id: 101, estimatePhase: "Budget – Quick ROM" },
        { id: 102, estimatePhase: "Budget – Concept" },
        { id: 103, estimatePhase: "GMP" },
      ],
    };

    const beforeRoundIds = before.rounds.map((r) => r.id);
    const plan = planSalesforceLink(
      before.job,
      {
        sfId: "SF-999",
        jobNumber: "25-1234",
        jobName: "Riverside Medical Tower",
      },
      beforeRoundIds,
    );

    expect(plan.jobId).toBe(42);
    expect(plan.preservedRoundIds).toEqual([101, 102, 103]);

    const after = applySalesforceLinkPlan(before, plan);

    expect(after.job.id).toBe(42);
    expect(after.job.jobNumber).toBe("25-1234");
    expect(after.job.isLinked).toBe(true);
    expect(after.rounds.map((r) => r.id)).toEqual(beforeRoundIds);
    expect(after.rounds.map((r) => r.estimatePhase)).toEqual([
      "Budget – Quick ROM",
      "Budget – Concept",
      "GMP",
    ]);
  });

  it("rejects a second Salesforce link on the same job", () => {
    expect(() =>
      planSalesforceLink(
        {
          id: 1,
          jobNumber: "25-1",
          jobName: "Already linked",
          salesforceId: "SF-1",
          isLinked: true,
        },
        { sfId: "SF-2", jobNumber: "25-2", jobName: "Other" },
        [1],
      ),
    ).toThrow(DomainError);
  });
});
