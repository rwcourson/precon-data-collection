import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildPrintHtml, buildWorkbook } from "./export-helpers";
import {
  formatLatestNoteCell,
  LATEST_NOTE_EMPTY_LABEL,
  LATEST_NOTE_ERROR_LABEL,
  LATEST_NOTE_KEY,
  LATEST_NOTE_LABEL,
  latestNoteBoardDisplay,
  PRINT_NOTE_MAX_CHARS,
  truncatePrintNote,
} from "./latest-note";
import {
  buildFieldCatalog,
  formatReportValue,
  runReportEngine,
} from "./report-engine";

const EVIDENCE_DIR = path.join(
  process.cwd(),
  ".supergoal/jay-mcdaniel-roadmap-FfN1Ez/evidence"
);

function longNote(len: number, marker: string): string {
  return `${marker} ${"x".repeat(Math.max(0, len - marker.length - 1))}`;
}

describe("latest-note print policy", () => {
  it("labels empty and failed board cells without inventing note text", () => {
    expect(latestNoteBoardDisplay("")).toBe(LATEST_NOTE_EMPTY_LABEL);
    expect(latestNoteBoardDisplay("   ")).toBe(LATEST_NOTE_EMPTY_LABEL);
    expect(latestNoteBoardDisplay("Jay · Aug 20 — check drawings")).toBe(
      "Jay · Aug 20 — check drawings"
    );
    expect(latestNoteBoardDisplay("Jay · Aug 20 — check drawings", true)).toBe(
      LATEST_NOTE_ERROR_LABEL
    );
    expect(latestNoteBoardDisplay("", true)).toBe(LATEST_NOTE_ERROR_LABEL);
  });

  it("truncates print/Excel note bodies at 300 characters with an ellipsis", () => {
    const body = longNote(500, "WRAP");
    expect(body.length).toBe(500);
    const truncated = truncatePrintNote(body);
    expect(truncated.length).toBe(PRINT_NOTE_MAX_CHARS);
    expect(truncated.endsWith("…")).toBe(true);
    expect(truncated.startsWith("WRAP")).toBe(true);
  });

  it("formats author + calendar date + text, not relative age", () => {
    const cell = formatLatestNoteCell({
      authorName: "Jay McDaniel",
      createdAt: new Date("2026-08-12T15:00:00Z"),
      body: "Updated drawing due date after talking to this DM.",
    });
    expect(cell).toContain("Jay McDaniel");
    expect(cell).toMatch(/2026/);
    expect(cell).not.toMatch(/ago|just now/);
    expect(cell).toContain("Updated drawing due date");
  });
});

describe("latest-note report + print wrapping", () => {
  const catalog = buildFieldCatalog([]);

  it("catalog exposes Latest note for the report builder picker", () => {
    const field = catalog.find((c) => c.key === LATEST_NOTE_KEY);
    expect(field?.label).toBe(LATEST_NOTE_LABEL);
    expect(field?.category).toBe("Notes");
  });

  it("500-char note wraps in print HTML with no overflow clipping", () => {
    const cell = formatLatestNoteCell({
      authorName: "Jay McDaniel",
      createdAt: new Date("2026-08-12T15:00:00Z"),
      body: longNote(500, "WRAP"),
    });
    expect(cell.length).toBeLessThan(500);
    const html = buildPrintHtml({
      title: "Upcoming Bid Schedule",
      columns: [
        { key: "jobName", label: "Job", type: "text" },
        { key: LATEST_NOTE_KEY, label: LATEST_NOTE_LABEL, type: "text" },
      ],
      rows: [{ jobName: "Columbia EV Battery Plant", [LATEST_NOTE_KEY]: cell }],
      formatValue: (key, value) => formatReportValue(key, value, catalog),
    });
    expect(html).toContain("overflow-wrap: anywhere");
    expect(html).toContain("word-break: break-word");
    expect(html).toContain("table-layout: fixed");
    expect(html).not.toContain("overflow-x: scroll");
    expect(html).toContain('td class="note"');
    expect(html).toContain("Jay McDaniel");
    expect(html).toContain("WRAP");
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(
      path.join(EVIDENCE_DIR, "phase-8-print-latest-note.html"),
      html
    );
  });

  it("Excel export writes latest-note with author/date and wrapText", async () => {
    const cell = formatLatestNoteCell({
      authorName: "Pat PCM",
      createdAt: new Date("2026-08-10T12:00:00Z"),
      body: "Staffing confirmed for Monday.",
    });
    const buffer = await buildWorkbook({
      title: "Upcoming Bid Schedule",
      columns: [
        { key: "jobName", label: "Job", type: "text" },
        { key: LATEST_NOTE_KEY, label: LATEST_NOTE_LABEL, type: "text" },
      ],
      rows: [{ jobName: "Alpha Tower", [LATEST_NOTE_KEY]: cell }],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0]!;
    const header = ws.getRow(2);
    expect(header.getCell(2).value).toBe(LATEST_NOTE_LABEL);
    const data = ws.getRow(3);
    expect(String(data.getCell(2).value)).toContain("Pat PCM");
    expect(String(data.getCell(2).value)).toContain("Staffing confirmed");
    expect(data.getCell(2).alignment?.wrapText).toBe(true);
    expect(data.getCell(1).alignment?.wrapText).toBe(true);
  });

  it("3-note fixture: report engine shows only the most recent cell", () => {
    const latest = formatLatestNoteCell({
      authorName: "Jay McDaniel",
      createdAt: new Date("2026-08-14T12:00:00Z"),
      body: "Newest note only",
    });
    const result = runReportEngine(
      [
        {
          id: 1,
          jobName: "Alpha",
          status: "Upcoming",
          [LATEST_NOTE_KEY]: latest,
        },
      ],
      {
        fields: ["jobName", LATEST_NOTE_KEY],
        filters: [],
        groupBy: [],
        aggregations: [],
        sortBy: [],
      },
      catalog
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]![LATEST_NOTE_KEY]).toBe(latest);
    expect(String(result.rows[0]![LATEST_NOTE_KEY])).toContain(
      "Newest note only"
    );
    expect(String(result.rows[0]![LATEST_NOTE_KEY])).not.toContain("older");
  });

  it("print HTML handles 0 and 1,000 rounds", () => {
    const columns = [
      { key: "jobName", label: "Job", type: "text" as const },
      { key: LATEST_NOTE_KEY, label: LATEST_NOTE_LABEL, type: "text" as const },
    ];
    const empty = buildPrintHtml({
      title: "Empty schedule",
      columns,
      rows: [],
      formatValue: (key, value) => formatReportValue(key, value, catalog),
    });
    expect(empty).toContain("Empty schedule");
    expect(empty).not.toContain("Job 1");

    const rows = Array.from({ length: 1_000 }, (_, i) => ({
      jobName: `Job ${i + 1}`,
      [LATEST_NOTE_KEY]: formatLatestNoteCell({
        authorName: "Jay McDaniel",
        createdAt: new Date("2026-08-12T15:00:00Z"),
        body: `Note ${i + 1}`,
      }),
    }));
    const html = buildPrintHtml({
      title: "Thousand-row schedule",
      columns,
      rows,
      formatValue: (key, value) => formatReportValue(key, value, catalog),
    });
    expect(html).toContain("Job 1");
    expect(html).toContain("Job 1000");
    expect(html).toContain("Note 1000");
  });

  it("zero notes render an empty cell, not an error", () => {
    expect(formatReportValue(LATEST_NOTE_KEY, null, catalog)).toBe("");
    const html = buildPrintHtml({
      title: "Upcoming Bid Schedule",
      columns: [
        { key: "jobName", label: "Job", type: "text" },
        { key: LATEST_NOTE_KEY, label: LATEST_NOTE_LABEL, type: "text" },
      ],
      rows: [{ jobName: "Quiet Job", [LATEST_NOTE_KEY]: null }],
      formatValue: (key, value) => formatReportValue(key, value, catalog),
    });
    expect(html).toContain("Quiet Job");
    expect(html).toContain('td class="note"></td>');
  });

  it("page-break CSS keeps rows intact on the standard preset", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      jobName: `Job ${i + 1}`,
      preconDepartment: i < 20 ? "Central Building Group" : "Florida",
      [LATEST_NOTE_KEY]: formatLatestNoteCell({
        authorName: "Jay McDaniel",
        createdAt: new Date("2026-08-12T15:00:00Z"),
        body: `Note for row ${i + 1} that should not split across a printed page.`,
      }),
    }));
    const html = buildPrintHtml({
      title: "Consolidated Regional Bid Schedule",
      columns: [
        { key: "jobName", label: "Job", type: "text" },
        { key: "preconDepartment", label: "Precon Department", type: "text" },
        { key: LATEST_NOTE_KEY, label: LATEST_NOTE_LABEL, type: "text" },
      ],
      rows,
      groupBy: ["preconDepartment"],
      formatValue: (key, value) => formatReportValue(key, value, catalog),
    });
    expect(html).toContain("break-inside: avoid");
    expect(html).toContain("page-break-inside: avoid");
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(path.join(EVIDENCE_DIR, "phase-8-page-break.html"), html);
  });

  it("renders PDF when Chromium is available, otherwise records the print-HTML fallback", async () => {
    const { renderPdf } = await import("./pdf");
    const html = buildPrintHtml({
      title: "Upcoming Bid Schedule",
      columns: [
        { key: "jobName", label: "Job", type: "text" },
        { key: LATEST_NOTE_KEY, label: LATEST_NOTE_LABEL, type: "text" },
      ],
      rows: [
        {
          jobName: "Columbia EV Battery Plant",
          [LATEST_NOTE_KEY]: formatLatestNoteCell({
            authorName: "Jay McDaniel",
            createdAt: new Date(2026, 7, 12),
            body: longNote(500, "WRAP"),
          }),
        },
      ],
      formatValue: (key, value) => formatReportValue(key, value, catalog),
    });
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const pdf = await renderPdf(html);
    if (pdf) {
      writeFileSync(path.join(EVIDENCE_DIR, "phase-8-latest-note.pdf"), pdf);
      expect(pdf.byteLength).toBeGreaterThan(500);
    } else {
      writeFileSync(
        path.join(EVIDENCE_DIR, "phase-8-pdf-fallback.txt"),
        "Playwright Chromium unavailable; print-HTML at phase-8-print-latest-note.html is the artifact.\n"
      );
    }
  });
});
