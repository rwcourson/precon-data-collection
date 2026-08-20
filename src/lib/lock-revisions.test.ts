import { describe, expect, it } from "vitest";
import {
  lockRevisionFieldDiffs,
  nextLockRevisionNumber,
} from "./lock-revisions";

describe("lock revisions", () => {
  it("increments from the highest existing revision", () => {
    expect(nextLockRevisionNumber([])).toBe(1);
    expect(nextLockRevisionNumber([1])).toBe(2);
    expect(nextLockRevisionNumber([2, 1])).toBe(3);
  });

  it("diffs consecutive snapshots without fabricating missing history", () => {
    expect(lockRevisionFieldDiffs(null, { estimateValue: 10 })).toEqual([
      { field: "estimateValue", from: "—", to: "10" },
    ]);
    expect(
      lockRevisionFieldDiffs(
        { estimateValue: 10, awardability: "Awardable" },
        { estimateValue: 12, awardability: "Awardable" }
      )
    ).toEqual([{ field: "estimateValue", from: "10", to: "12" }]);
  });
});
