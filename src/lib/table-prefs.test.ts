import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseUserTablePrefsConfig,
  resolveBidScheduleTableState,
} from "@/lib/table-prefs";
import { parseBidScheduleViewConfig } from "@/lib/view-config";

const LEGACY_VIEW = {
  section: "upcoming",
  group: "preconDepartment",
  sort: "bidDueDate",
  dir: "asc" as const,
  region: "Florida",
  density: "summary" as const,
  columns: ["jobNumber", "jobName", "status"],
};

describe("user table prefs config", () => {
  it("reuses the phase-4 view parser for columns and density", () => {
    const parsed = parseUserTablePrefsConfig({
      ...LEGACY_VIEW,
      columnWidths: { jobName: 280 },
      defaultViewId: 12,
    });
    expect(parsed.columns).toEqual(
      parseBidScheduleViewConfig(LEGACY_VIEW).columns
    );
    expect(parsed.density).toBe("summary");
    expect(parsed.columnWidths).toEqual({ jobName: 280 });
    expect(parsed.defaultViewId).toBe(12);
    expect(parsed.viewMode).toBeUndefined();
  });

  it("stores viewMode on personal prefs", () => {
    const parsed = parseUserTablePrefsConfig({
      viewMode: "cards",
      density: "summary",
    });
    expect(parsed.viewMode).toBe("cards");
  });

  it("falls back to empty prefs for garbage JSONB", () => {
    const parsed = parseUserTablePrefsConfig({
      nope: true,
      columns: "bad",
      defaultViewId: "x",
    });
    expect(parsed.version).toBe(2);
    expect(parsed.columns).toBeUndefined();
    expect(parsed.columnWidths).toBeUndefined();
    expect(parsed.defaultViewId).toBeNull();
  });
});

describe("resolveBidScheduleTableState precedence", () => {
  const prefs = parseUserTablePrefsConfig({
    columns: ["jobNumber", "jobName"],
    density: "detail",
    columnWidths: { owner: 120 },
    defaultViewId: 2,
  });
  const views = [
    {
      id: 1,
      config: { columns: ["jobName", "status"], density: "summary" as const },
    },
    {
      id: 2,
      config: {
        columns: ["jobName", "bidDueDate"],
        density: "detail" as const,
      },
    },
  ];

  it("applies a named view over prefs", () => {
    const resolved = resolveBidScheduleTableState({
      urlViewId: 1,
      prefs,
      views,
    });
    expect(resolved.source).toBe("view");
    expect(resolved.activeViewId).toBe(1);
    expect(resolved.columns).toEqual(["jobName", "status"]);
    expect(resolved.columnWidths).toEqual({ owner: 120 });
  });

  it("restores prefs after clearing a named view without snapping to the default", () => {
    const resolved = resolveBidScheduleTableState({
      skipDefaultView: true,
      prefs,
      views,
    });
    expect(resolved.source).toBe("prefs");
    expect(resolved.activeViewId).toBeUndefined();
    expect(resolved.columns).toEqual(["jobNumber", "jobName"]);
    expect(resolved.density).toBe("detail");
  });

  it("auto-applies the starred default view on load", () => {
    const resolved = resolveBidScheduleTableState({ prefs, views });
    expect(resolved.source).toBe("view");
    expect(resolved.activeViewId).toBe(2);
    expect(resolved.columns).toEqual(["jobName", "bidDueDate"]);
    expect(resolved.defaultViewId).toBe(2);
  });

  it("uses density defaults when prefs are empty", () => {
    const resolved = resolveBidScheduleTableState({
      prefs: parseUserTablePrefsConfig({}),
      views: [],
    });
    expect(resolved.source).toBe("defaults");
    expect(resolved.columns).toBeUndefined();
    expect(resolved.density).toBe("summary");
  });

  it("lets URL columns override prefs and named views", () => {
    const resolved = resolveBidScheduleTableState({
      urlViewId: 1,
      urlColumns: ["jobNumber", "bidDueDate"],
      prefs,
      views,
    });
    expect(resolved.columns).toEqual(["jobNumber", "bidDueDate"]);
  });
});

describe("bid-schedule width storage", () => {
  it("does not keep a localStorage path for column widths", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/bid-schedule/sheet-table.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/localStorage/);
    expect(source).not.toMatch(/precon-bid-schedule-col-widths/);
  });
});
