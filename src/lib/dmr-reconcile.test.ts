import { describe, expect, it } from "vitest";
import { reconcileDmr } from "./dmr-reconcile";

describe("dmr reconcile", () => {
  it("computes deltas without mutating inputs", () => {
    const dmr = [{ jobNumber: "26001", dmrValue: 1_000_000 }];
    const precon = [
      {
        jobNumber: "26001",
        jobName: "School",
        region: "Central",
        preconValue: 1_400_000,
        roundId: 9,
      },
    ];
    const { rows, totals } = reconcileDmr(dmr, precon);
    expect(rows[0].delta).toBe(400_000);
    expect(totals.delta).toBe(400_000);
    expect(dmr[0].dmrValue).toBe(1_000_000);
  });

  it("keeps dmr-only and precon-only rows", () => {
    const { rows } = reconcileDmr(
      [{ jobNumber: "A", dmrValue: 10 }],
      [
        {
          jobNumber: "B",
          jobName: "B",
          region: "Central",
          preconValue: 20,
          roundId: 1,
        },
      ]
    );
    expect(rows.find((r) => r.jobNumber === "A")?.status).toBe("dmr_only");
    expect(rows.find((r) => r.jobNumber === "B")?.status).toBe("precon_only");
  });
});
