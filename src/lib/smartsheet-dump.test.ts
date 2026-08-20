import { describe, expect, it } from "vitest";
import {
  isSmartsheetHistoryDumpFile,
  parseSmartsheetDumpSheets,
  type SmartsheetSheetJson,
} from "./integrations/smartsheet/parse";
import {
  buildSmartsheetDumpCounts,
  checksumSmartsheetDump,
  countLivePreconDump,
  countSmartsheetDraftDump,
  dumpRequiredFieldFlagCount,
  liveRoundIdentityKey,
  reconcileSmartsheetDump,
  smartsheetReadsMayDisable,
} from "./smartsheet-dump";

const dump = {
  jobs: 40,
  rounds: 62,
  duplicates: 2,
  requiredFieldFlags: 5,
  checksum: "abc",
};

function sheet(
  cells: { columnId: number; displayValue: string }[]
): SmartsheetSheetJson {
  return {
    columns: [
      { id: 1, title: "Job #" },
      { id: 2, title: "Job Name" },
      { id: 3, title: "Estimate Phase" },
      { id: 4, title: "Region" },
      { id: 5, title: "Status" },
      { id: 6, title: "Bid Date" },
      { id: 7, title: "Awardability" },
      { id: 8, title: "Estimate Value $" },
      { id: 9, title: "Fee - Back Page $" },
      { id: 10, title: "Fee - Expected $" },
      { id: 11, title: "Lead Precon Manager" },
    ],
    rows: [{ cells }],
  };
}

const submittedIdentity = [
  { columnId: 1, displayValue: "2600001" },
  { columnId: 2, displayValue: "Alpha Hospital" },
  { columnId: 3, displayValue: "GMP" },
  { columnId: 4, displayValue: "Georgia" },
  { columnId: 5, displayValue: "Submitted" },
  { columnId: 6, displayValue: "2026-09-01" },
];

describe("Smartsheet dump rehearsal", () => {
  it("is green only when counts and checksum match", () => {
    expect(reconcileSmartsheetDump(dump, dump)).toEqual({
      ok: true,
      mismatches: [],
    });
    const mismatch = reconcileSmartsheetDump(dump, { ...dump, jobs: 39 });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.mismatches.join(" ")).toMatch(/job count/);
  });

  it("keeps Smartsheet readable until a signed green report", () => {
    expect(smartsheetReadsMayDisable({ ok: true, signedOff: false })).toBe(
      false
    );
    expect(smartsheetReadsMayDisable({ ok: false, signedOff: true })).toBe(
      false
    );
    expect(smartsheetReadsMayDisable({ ok: true, signedOff: true })).toBe(true);
  });
});

describe("Smartsheet dump file filter", () => {
  it("uses the same include/exclude rules as import", () => {
    expect(
      isSmartsheetHistoryDumpFile("CEN_Bid_Schedule_-_Active__1.json")
    ).toBe(true);
    expect(
      isSmartsheetHistoryDumpFile("GA_Estimate_Metrics_Capture__2.json")
    ).toBe(true);
    expect(
      isSmartsheetHistoryDumpFile("CEN_Self_Perform_Estimate_Metrics__3.json")
    ).toBe(false);
    expect(isSmartsheetHistoryDumpFile("Dashboard__4.json")).toBe(false);
  });
});

describe("Smartsheet dump counts", () => {
  it("checksums sorted name+bytes and changes when content changes", () => {
    const files = [
      { name: "b.json", bytes: "two" },
      { name: "a.json", bytes: "one" },
    ];
    const first = checksumSmartsheetDump(files);
    expect(checksumSmartsheetDump([...files].reverse())).toBe(first);
    expect(
      checksumSmartsheetDump([{ name: "a.json", bytes: "changed" }, files[1]!])
    ).not.toBe(first);
  });

  it("counts merged jobs/rounds, collapsed duplicates, and complete-status flags", () => {
    const schedule = "CEN_Bid_Schedule_-_Active.json";
    const metrics = "CEN_Estimate_Metrics_Capture.json";
    const { drafts, rawDataRows } = parseSmartsheetDumpSheets([
      { fileName: schedule, sheet: sheet(submittedIdentity) },
      { fileName: metrics, sheet: sheet(submittedIdentity) },
    ]);
    expect(rawDataRows).toBe(2);
    expect(drafts).toHaveLength(1);
    const counts = countSmartsheetDraftDump(drafts, rawDataRows);
    expect(counts).toMatchObject({
      jobs: 1,
      rounds: 1,
      duplicates: 0,
      mergedExtras: 1,
    });
    expect(counts.requiredFieldFlags).toBe(
      dumpRequiredFieldFlagCount(drafts[0]!)
    );
    expect(counts.requiredFieldFlags).toBeGreaterThan(0);
    expect(
      dumpRequiredFieldFlagCount({ ...drafts[0]!, status: "upcoming" })
    ).toBe(0);

    const files = [
      { name: schedule, bytes: JSON.stringify(sheet(submittedIdentity)) },
      { name: metrics, bytes: JSON.stringify(sheet(submittedIdentity)) },
    ];
    const built = buildSmartsheetDumpCounts(files, drafts, rawDataRows);
    expect(built.checksum).toHaveLength(64);
    expect(reconcileSmartsheetDump(built, built).ok).toBe(true);
    const live = countLivePreconDump({
      jobNumbers: drafts.map((draft) => draft.jobNumber),
      rounds: drafts.map((draft, index) => ({
        ...draft,
        identityKey: liveRoundIdentityKey({ jobId: 1, roundNumber: index + 1 }),
      })),
      dumpChecksum: built.checksum,
    });
    expect(reconcileSmartsheetDump(built, live).ok).toBe(true);
    expect(smartsheetReadsMayDisable({ ok: true, signedOff: false })).toBe(
      false
    );
  });

  it("does not flag complete drafts that have dump-required values", () => {
    const complete = sheet([
      ...submittedIdentity,
      { columnId: 7, displayValue: "Awardable" },
      { columnId: 8, displayValue: "1000000" },
      { columnId: 9, displayValue: "40000" },
      { columnId: 10, displayValue: "35000" },
      { columnId: 11, displayValue: "Pat Lead" },
    ]);
    const { drafts, rawDataRows } = parseSmartsheetDumpSheets([
      { fileName: "CEN_Bid_Schedule_-_Active.json", sheet: complete },
    ]);
    expect(
      countSmartsheetDraftDump(drafts, rawDataRows).requiredFieldFlags
    ).toBe(0);
  });
});
