import { describe, expect, it } from "vitest";
import {
  isScheduleDue,
  schedulePeriodKey,
  weekPeriodKey,
  zonedDateParts,
} from "@/lib/distribution-schedule";

describe("report schedule clock", () => {
  it("treats Friday 8am Chicago as due and keys the calendar day", () => {
    const fridayEight = new Date("2026-08-21T13:00:00Z");
    const parts = zonedDateParts(fridayEight, "America/Chicago");
    expect(parts.weekday).toBe(5);
    expect(parts.hour).toBe(8);
    expect(isScheduleDue(fridayEight, "America/Chicago", 5, 8)).toBe(true);
    expect(isScheduleDue(fridayEight, "America/Chicago", 1, 8)).toBe(false);
    expect(schedulePeriodKey(fridayEight, "America/Chicago", 5, 8)).toBe("2026-08-21-5-08");
  });

  it("keeps weekly period keys stable inside a week", () => {
    const a = weekPeriodKey(new Date("2026-08-03T12:00:00Z"), "America/Chicago");
    const b = weekPeriodKey(new Date("2026-08-07T12:00:00Z"), "America/Chicago");
    expect(a).toBe(b);
  });

  it("honors the timezone at week boundaries and keeps UTC keys stable", () => {
    // Monday 2026-08-03 00:30 UTC is still Sunday 2026-08-02 in Chicago.
    const boundary = new Date("2026-08-03T00:30:00Z");
    expect(weekPeriodKey(boundary, "UTC")).toBe("2026-W32");
    expect(weekPeriodKey(boundary, "America/Chicago")).toBe("2026-W31");
    // Format stays YYYY-Www for UTC.
    expect(weekPeriodKey(new Date("2026-08-21T13:00:00Z"), "UTC")).toBe("2026-W34");
  });
});
