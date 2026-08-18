import { describe, expect, it } from "vitest";
import {
  bidDueUrgency,
  bidSchedulePrefsHref,
  bidScheduleViewHref,
  buildBidScheduleSections,
  parseBidScheduleGroupBy,
  parseBidScheduleSort,
} from "./bid-schedule";
import { groupRowsByField } from "./sheets";

type Row = {
  id: number;
  status: string;
  preconDepartment: string;
  marketSector: string | null;
  estimatePhase: string;
  bidDueDate: string | null;
  jobName: string;
  jobNumber: string;
  roundNumber: number;
};

function row(partial: Partial<Row> & Pick<Row, "id" | "status">): Row {
  return {
    preconDepartment: "Central Building Group",
    marketSector: "Healthcare – Acute",
    estimatePhase: "GMP",
    bidDueDate: "2026-09-01",
    jobName: `Job ${partial.id}`,
    jobNumber: `J-${partial.id}`,
    roundNumber: 1,
    ...partial,
  };
}

describe("bid schedule group/sort", () => {
  it("parses group-by and sort URL values", () => {
    expect(parseBidScheduleGroupBy("marketSector")).toBe("marketSector");
    expect(parseBidScheduleGroupBy("nope")).toBe("none");
    expect(parseBidScheduleSort("estimatePhase", "desc")).toEqual({
      field: "estimatePhase",
      dir: "desc",
    });
    expect(parseBidScheduleSort(undefined, undefined)).toEqual({
      field: "bidDueDate",
      dir: "asc",
    });
  });

  it("keeps lifecycle sections and groups within each with stable sort", () => {
    const rows = [
      row({
        id: 1,
        status: "outstanding",
        preconDepartment: "Texas",
        bidDueDate: "2026-10-01",
        jobName: "Zulu",
      }),
      row({
        id: 2,
        status: "active",
        preconDepartment: "Texas",
        bidDueDate: "2026-08-01",
        jobName: "Alpha",
      }),
      row({
        id: 3,
        status: "active",
        preconDepartment: "Florida",
        bidDueDate: "2026-07-01",
        jobName: "Bravo",
      }),
      row({
        id: 4,
        status: "upcoming",
        preconDepartment: "Florida",
        bidDueDate: "2026-11-01",
        jobName: "Charlie",
      }),
    ];

    const sections = buildBidScheduleSections(rows, "preconDepartment", {
      field: "bidDueDate",
      dir: "asc",
    });

    expect(sections.map((s) => s.key)).toEqual([
      "active",
      "upcoming",
      "outstanding",
    ]);

    const active = sections.find((s) => s.key === "active")!;
    expect(active.groups?.map((g) => g.label)).toEqual(["Florida", "Texas"]);
    expect(active.groups?.[0].rows.map((r) => r.id)).toEqual([3]);
    expect(active.groups?.[1].rows.map((r) => r.id)).toEqual([2]);
  });

  it("reuses shared groupRowsByField labeling for blank market sector", () => {
    const grouped = groupRowsByField(
      [row({ id: 1, status: "active", marketSector: null })],
      (r) => r.marketSector
    );
    expect(grouped[0]?.label).toBe("(blank)");
  });

  it("flags bid-due urgency at overdue / 7 / 14 day bands", () => {
    const today = new Date("2026-08-14T12:00:00");
    expect(bidDueUrgency("2026-08-10", today)).toBe("overdue");
    expect(bidDueUrgency("2026-08-14", today)).toBe("week");
    expect(bidDueUrgency("2026-08-21", today)).toBe("week");
    expect(bidDueUrgency("2026-08-28", today)).toBe("fortnight");
    expect(bidDueUrgency("2026-09-15", today)).toBe(null);
    expect(bidDueUrgency(null, today)).toBe(null);
  });

  it("builds a saved-view URL from config without default noise", () => {
    expect(
      bidScheduleViewHref(
        {
          section: "active",
          group: "none",
          sort: "bidDueDate",
          dir: "asc",
          density: "detail",
        },
        12
      )
    ).toBe("/bid-schedule?section=active&density=detail&view=12");
    expect(
      bidSchedulePrefsHref({
        section: "active",
        group: "none",
        sort: "bidDueDate",
        dir: "asc",
        density: "detail",
      })
    ).toBe("/bid-schedule?section=active&density=detail&source=prefs");
  });
});
