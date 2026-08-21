import { describe, expect, it } from "vitest";
import {
  ganttBarRect,
  ganttMonthTicks,
  ganttRange,
  ganttTodayLeft,
  utcStamp,
} from "@/lib/schedule-gantt";

describe("ganttRange", () => {
  it("pads the extent so bars are not flush to the track edges", () => {
    const start = utcStamp("2026-07-12");
    const end = utcStamp("2026-08-01");
    const range = ganttRange(
      [start, end],
      new Date("2026-07-20T00:00:00Z"),
      10
    );
    expect(range.start).toBe(start - 10 * 86_400_000);
    expect(range.end).toBe(end + 10 * 86_400_000);
    expect(range.span).toBe(range.end - range.start);
  });
});

describe("ganttBarRect", () => {
  it("keeps short efforts readable without overflowing the track", () => {
    const rangeStart = utcStamp("2026-07-01");
    const span = 100 * 86_400_000;
    const bar = ganttBarRect(
      utcStamp("2026-07-12"),
      utcStamp("2026-07-13"),
      rangeStart,
      span,
      8
    );
    expect(bar.width).toBe(8);
    expect(bar.left + bar.width).toBeLessThanOrEqual(100);
  });

  it("clamps a late short bar so the label stays on the chart", () => {
    const rangeStart = utcStamp("2026-07-01");
    const span = 100 * 86_400_000;
    const bar = ganttBarRect(
      utcStamp("2026-10-05"),
      utcStamp("2026-10-06"),
      rangeStart,
      span,
      12
    );
    expect(bar.left + bar.width).toBeCloseTo(100, 5);
    expect(bar.width).toBe(12);
  });
});

describe("ganttMonthTicks", () => {
  it("emits month labels inside the padded range", () => {
    const start = utcStamp("2026-07-12");
    const end = utcStamp("2026-09-09");
    const ticks = ganttMonthTicks(start, end);
    expect(ticks.map((tick) => tick.label)).toEqual(["Aug", "Sep"]);
    expect(ticks.every((tick) => tick.left >= 0 && tick.left <= 100)).toBe(
      true
    );
  });
});

describe("ganttTodayLeft", () => {
  it("returns null when today is outside the chart", () => {
    expect(
      ganttTodayLeft(
        utcStamp("2026-07-01"),
        10 * 86_400_000,
        utcStamp("2026-01-01")
      )
    ).toBeNull();
  });
});
