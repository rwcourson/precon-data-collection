import { describe, expect, it } from "vitest";
import { magnusExternalScope } from "./magnus-scope";

describe("Magnus external locked scope", () => {
  it("drops unlocked rows and keeps locked revisions", () => {
    const scoped = magnusExternalScope([
      { id: 1, status: "upcoming" },
      { id: 2, status: "locked" },
      { id: 3, status: "post_bid" },
      { id: 4, status: "locked" },
    ]);
    expect(scoped.map((row) => row.id)).toEqual([2, 4]);
  });
});
