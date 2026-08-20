import { describe, expect, it } from "vitest";
import {
  applyLockedPublication,
  currentLockedShadowView,
  mergeOnRoundAndRevisionSql,
  publicationRevisionFromPayload,
  retractLockedRevisionSql,
  warehouseProductEventName,
} from "./publication-sql";

describe("locked warehouse SQL", () => {
  it("merges by round_id and lock_revision", () => {
    const sql = mergeOnRoundAndRevisionSql(
      "catalog.precon.locked_rounds",
      ["round_id", "lock_revision", "status"],
      "SELECT 1 AS round_id, 2 AS lock_revision, 'locked' AS status"
    );
    expect(sql).toContain(
      "ON target.round_id = source.round_id AND target.lock_revision = source.lock_revision"
    );
    expect(sql).toContain(
      "WHEN MATCHED THEN UPDATE SET status = source.status"
    );
  });

  it("retracts only the payload revision", () => {
    expect(publicationRevisionFromPayload({ revision: 3 })).toBe(3);
    expect(publicationRevisionFromPayload({})).toBeNull();
    expect(retractLockedRevisionSql("t", 9, 3)).toBe(
      "UPDATE t SET status = 'retracted' WHERE round_id = 9 AND lock_revision = 3"
    );
  });

  it("keeps retry MERGE and retract statements idempotent", () => {
    const merge = mergeOnRoundAndRevisionSql(
      "t",
      ["round_id", "lock_revision", "status"],
      "SELECT 1 AS round_id, 2 AS lock_revision, 'locked' AS status"
    );
    const retract = retractLockedRevisionSql("t", 1, 2);
    expect(merge).toBe(
      mergeOnRoundAndRevisionSql(
        "t",
        ["round_id", "lock_revision", "status"],
        "SELECT 1 AS round_id, 2 AS lock_revision, 'locked' AS status"
      )
    );
    expect(retract).toBe(retractLockedRevisionSql("t", 1, 2));
    expect(merge).toContain("WHEN MATCHED THEN UPDATE");
    expect(retract).toContain("status = 'retracted'");
  });

  it("treats a second MERGE of the same revision as identity and retracts it from the current view", () => {
    const publish = {
      type: "publish" as const,
      roundId: 1,
      revision: 2,
    };
    const once = applyLockedPublication([], publish);
    const twice = applyLockedPublication(once, publish);
    expect(twice).toEqual(once);
    expect(currentLockedShadowView(twice)).toEqual([
      { round_id: 1, lock_revision: 2, status: "locked" },
    ]);
    const retracted = applyLockedPublication(twice, {
      type: "retract",
      roundId: 1,
      revision: 2,
    });
    expect(currentLockedShadowView(retracted)).toEqual([]);
    expect(
      applyLockedPublication(retracted, {
        type: "retract",
        roundId: 1,
        revision: 2,
      })
    ).toEqual(retracted);
  });

  it("names warehouse telemetry only after publish or retract", () => {
    expect(warehouseProductEventName("publish")).toBe("warehouse.published");
    expect(warehouseProductEventName("retract")).toBe("warehouse.retracted");
    expect(warehouseProductEventName("queued")).toBeNull();
  });
});
