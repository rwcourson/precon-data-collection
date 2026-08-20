import { describe, expect, it } from "vitest";
import { summarizeChangesSinceWatermarks } from "./change-watermarks";

const audits = [
  { id: 10, roundId: 1, userId: 2, field: "bidDueDate" },
  { id: 11, roundId: 1, userId: 2, field: "drawingsDueDate" },
  { id: 12, roundId: 1, userId: 3, field: "bidDueDate" },
];

describe("independent change watermarks", () => {
  it("lets two users acknowledge the same round independently", () => {
    const pcm = summarizeChangesSinceWatermarks(audits, 3, new Map([[1, 10]]));
    const rpd = summarizeChangesSinceWatermarks(audits, 2, new Map());
    expect(pcm.get(1)?.fields).toEqual(["drawingsDueDate"]);
    expect(rpd.get(1)?.fields).toEqual(["bidDueDate"]);
    expect(pcm.get(1)?.count).toBe(1);
    expect(rpd.get(1)?.count).toBe(1);
  });

  it("does not highlight a user's own edits", () => {
    const self = summarizeChangesSinceWatermarks(audits, 2, new Map());
    expect(self.get(1)?.fields).not.toContain("drawingsDueDate");
  });
});
