import { describe, expect, it } from "vitest";
import {
  calendarMonthDays,
  parseIsoDate,
  shiftMonth,
  toIsoDate,
} from "@/lib/calendar-grid";

describe("calendar grid", () => {
  it("always returns six Sunday-start weeks", () => {
    const days = calendarMonthDays(new Date(2026, 7, 1));
    expect(days).toHaveLength(42);
    expect(days[0]!.getDay()).toBe(0);
    expect(days[6]!.getDay()).toBe(6);
    expect(toIsoDate(days[0]!)).toBe("2026-07-26");
    expect(toIsoDate(days[41]!)).toBe("2026-09-05");
  });

  it("parses and writes local ISO dates", () => {
    expect(parseIsoDate("2026-08-17")?.getDate()).toBe(17);
    expect(parseIsoDate("not-a-date")).toBeNull();
    expect(toIsoDate(new Date(2026, 7, 17))).toBe("2026-08-17");
  });

  it("shifts by whole months", () => {
    expect(toIsoDate(shiftMonth(new Date(2026, 7, 17), -1))).toBe("2026-07-01");
  });
});
