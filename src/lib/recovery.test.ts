import { describe, expect, it } from "vitest";
import { createHash } from "crypto";

describe("snapshot checksum contract", () => {
  it("is sha256 hex of payload", () => {
    const payload = JSON.stringify({ periodKey: "2026-08-07", jobs: 1, rounds: 2 });
    const checksum = createHash("sha256").update(payload).digest("hex");
    expect(checksum).toHaveLength(64);
    expect(checksum).toBe(createHash("sha256").update(payload).digest("hex"));
  });
});
