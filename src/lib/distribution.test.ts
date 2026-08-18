import { describe, expect, it } from "vitest";
import { weekPeriodKey } from "@/lib/report-presets";

describe("distribution schedule", () => {
  it("is stable for the same calendar week", () => {
    const a = weekPeriodKey(
      new Date("2026-08-03T12:00:00Z"),
      "America/Chicago"
    );
    const b = weekPeriodKey(
      new Date("2026-08-07T12:00:00Z"),
      "America/Chicago"
    );
    expect(a).toBe(b);
  });

  it("changes across week boundaries", () => {
    const a = weekPeriodKey(
      new Date("2026-08-02T12:00:00Z"),
      "America/Chicago"
    );
    const b = weekPeriodKey(
      new Date("2026-08-10T12:00:00Z"),
      "America/Chicago"
    );
    expect(a).not.toBe(b);
  });
});
