import { describe, expect, it } from "vitest";
import {
  COMPANY_COLUMNS_SECTION,
  cellsForRoundEntry,
  columnsForCustomEntry,
  columnsForRoundEntry,
  entrySectionOptions,
  entryViewHref,
  filterSheetColumnsBySection,
  isSheetEditableKey,
  parseEntrySection,
  parseEntryViewMode,
  sectionSlug,
} from "@/lib/entry-view";

describe("parseEntryViewMode", () => {
  it("defaults to form and only treats sheet as the alternative", () => {
    expect(parseEntryViewMode(undefined)).toBe("form");
    expect(parseEntryViewMode("table")).toBe("form");
    expect(parseEntryViewMode("sheet")).toBe("sheet");
    expect(parseEntryViewMode(["sheet"])).toBe("sheet");
  });
});

describe("entryViewHref", () => {
  it("omits viewMode for form and preserves the rest of the query", () => {
    expect(
      entryViewHref("/rounds/9", { tab: "region", viewMode: "sheet" }, "form")
    ).toBe("/rounds/9?tab=region");
    expect(entryViewHref("/post-bid", { mine: "1" }, "sheet")).toBe(
      "/post-bid?mine=1&viewMode=sheet"
    );
    expect(
      entryViewHref(
        "/rounds/9",
        { section: "labor", viewMode: "sheet" },
        "form"
      )
    ).toBe("/rounds/9?section=labor");
  });
});

describe("round entry sheet columns", () => {
  it("keeps schedule cores only and leaves identity read-only", () => {
    const columns = columnsForRoundEntry({
      mode: "schedule",
      lists: { awardability: ["Hard Bid"] },
    });
    expect(columns.some((column) => column.key === "estimateValue")).toBe(
      false
    );
    expect(columns.find((column) => column.key === "jobName")?.editable).toBe(
      false
    );
    expect(
      columns.find((column) => column.key === "awardability")?.options
    ).toEqual(["Hard Bid"]);
  });

  it("appends company custom columns only on the full post-bid set", () => {
    const custom = [
      {
        id: 4,
        label: "Bonding note",
        type: "text" as const,
        options: null,
      },
    ];
    const schedule = columnsForRoundEntry({
      mode: "schedule",
      lists: {},
      customCols: custom,
    });
    const postBid = columnsForRoundEntry({
      mode: "postBid",
      lists: {},
      customCols: custom,
    });
    expect(schedule.some((column) => column.key === "custom:4")).toBe(false);
    expect(postBid.some((column) => column.key === "estimateValue")).toBe(true);
    expect(postBid.find((column) => column.key === "custom:4")).toMatchObject({
      label: "Bonding note",
      editable: true,
    });
  });

  it("builds region-extra columns as editable custom cells", () => {
    const columns = columnsForCustomEntry([
      {
        id: 8,
        label: "Local permit",
        type: "dropdown",
        options: ["Yes", "No"],
      },
    ]);
    expect(columns).toEqual([
      expect.objectContaining({
        key: "custom:8",
        editable: true,
        options: ["Yes", "No"],
      }),
    ]);
  });
});

describe("sheet editability", () => {
  it("blocks job identity, lead, and multi fields from cell edits", () => {
    expect(isSheetEditableKey("jobNumber", "text")).toBe(false);
    expect(isSheetEditableKey("estimateLead", "dropdown")).toBe(false);
    expect(isSheetEditableKey("selfPerformWorkType", "multi")).toBe(false);
    expect(isSheetEditableKey("estimateValue", "dollars")).toBe(true);
    expect(isSheetEditableKey("custom:2", "text")).toBe(true);
  });
});

describe("cellsForRoundEntry", () => {
  it("joins multi values and maps custom column ids", () => {
    const cells = cellsForRoundEntry({
      columns: [
        { key: "jobName" },
        { key: "owner" },
        { key: "selfPerformWorkType" },
        { key: "custom:4" },
      ],
      values: { owner: "City of Dallas" },
      multi: { selfPerformWorkType: ["Concrete", "Steel"] },
      custom: { 4: "Need rider" },
      jobNumber: "123",
      jobName: "Museum",
    });
    expect(cells).toEqual({
      jobName: "Museum",
      owner: "City of Dallas",
      selfPerformWorkType: "Concrete, Steel",
      "custom:4": "Need rider",
    });
  });
});

describe("entry sections", () => {
  it("slugs group names and defaults the query param to all", () => {
    expect(sectionSlug("Estimate Value & Fee")).toBe("estimate-value-and-fee");
    expect(parseEntrySection(undefined)).toBe("all");
    expect(parseEntrySection("labor")).toBe("labor");
  });

  it("lists schedule cores without post-bid groups, then the full set", () => {
    const schedule = entrySectionOptions({ mode: "schedule" }).map(
      (option) => option.label
    );
    const postBid = entrySectionOptions({
      mode: "postBid",
      includeCompanyColumns: true,
    });
    expect(schedule[0]).toBe("All sections");
    expect(schedule).toContain("Project Identity");
    expect(schedule).toContain("Self-Perform");
    expect(schedule).not.toContain("Labor");
    expect(schedule).not.toContain(COMPANY_COLUMNS_SECTION);
    expect(postBid.some((option) => option.label === "Labor")).toBe(true);
    expect(postBid.at(-1)).toEqual({
      value: sectionSlug(COMPANY_COLUMNS_SECTION),
      label: COMPANY_COLUMNS_SECTION,
    });
  });

  it("filters sheet columns to one group and pins job name on queues", () => {
    const columns = columnsForRoundEntry({
      mode: "postBid",
      lists: {},
      customCols: [
        { id: 4, label: "Bonding note", type: "text" as const, options: null },
      ],
    });
    const labor = filterSheetColumnsBySection(columns, "labor", true);
    expect(labor.map((column) => column.key)).toEqual([
      "jobName",
      "jobNumber",
      ...columns
        .filter((column) => column.group === "Labor")
        .map((column) => column.key),
    ]);
    expect(
      filterSheetColumnsBySection(columns, "optional-company-columns").map(
        (column) => column.key
      )
    ).toEqual(["custom:4"]);
    expect(filterSheetColumnsBySection(columns, "unknown-group")).toBe(columns);
  });
});
