import { describe, expect, it } from "vitest";
import { postBidShowsMineOnly } from "./post-bid-queue";

describe("post-bid mine queue", () => {
  it("defaults estimate leads to their own owed queue", () => {
    expect(postBidShowsMineOnly("estimate_lead", undefined)).toBe(true);
    expect(postBidShowsMineOnly("estimate_lead", "1")).toBe(true);
    expect(postBidShowsMineOnly("estimate_lead", "0")).toBe(false);
  });

  it("keeps other roles on the regional queue unless they opt in", () => {
    expect(postBidShowsMineOnly("pcm", undefined)).toBe(false);
    expect(postBidShowsMineOnly("rpd", undefined)).toBe(false);
    expect(postBidShowsMineOnly("pcm", "1")).toBe(true);
    expect(postBidShowsMineOnly("rpd", "0")).toBe(false);
  });
});
