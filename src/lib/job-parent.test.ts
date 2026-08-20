import { describe, expect, it } from "vitest";
import { parentWouldCycle } from "./job-parent";

describe("parent job acyclicity", () => {
  it("rejects self-parent and ancestor loops without minting a board duplicate", () => {
    expect(parentWouldCycle(2, 2, new Map())).toBe(true);
    expect(parentWouldCycle(2, 1, new Map([[1, 2]]))).toBe(true);
    expect(parentWouldCycle(3, 1, new Map([[1, 2]]))).toBe(false);
    expect(
      parentWouldCycle(
        4,
        3,
        new Map([
          [3, 2],
          [2, 1],
        ])
      )
    ).toBe(false);
    expect(
      parentWouldCycle(
        1,
        3,
        new Map([
          [3, 2],
          [2, 1],
        ])
      )
    ).toBe(true);
  });
});
