import { describe, expect, it } from "vitest";
import {
  buildDestiniFieldDiffs,
  DESTINI_WRITABLE_KEYS,
  destiniChecksumIsApplied,
  detectDestiniFormat,
  filterWritableValues,
  mapDestiniRow,
  mapDestiniSheet,
  normLabel,
  parseDestiniCsv,
  parseDestiniVerticalSheet,
} from "./destini-import";

describe("normLabel", () => {
  it("normalizes punctuation and dollars", () => {
    expect(normLabel("Fee – Back Page $")).toBe("fee - back page");
    expect(normLabel("GC $ Proposed – Owner SOV")).toBe(
      "gc proposed - owner sov"
    );
  });
});

describe("tabular map", () => {
  it("maps known headers onto writable field keys", () => {
    const row = mapDestiniRow(
      [
        "Job Number",
        "Estimate Phase",
        "Estimate Value $",
        "Fee - Back Page $",
        "GC $ Proposed - Owner SOV",
        "Mystery Col",
      ],
      ["2600123", "GMP", "12500000", "400000", "250000", "x"]
    );
    expect(row.jobNumber).toBe("2600123");
    expect(row.estimatePhase).toBe("GMP");
    expect(row.values.estimateValue).toBe(12_500_000);
    expect(row.values.feeBackPage).toBe(400_000);
    expect(row.values.gcProposedOwnerSov).toBe(250_000);
    expect(row.unmappedHeaders).toContain("Mystery Col");
    expect(row.values).not.toHaveProperty("jobNumber");
    expect(row.values).not.toHaveProperty("jobName");
  });

  it("does not import judgmental / non-Destini columns even if present", () => {
    const row = mapDestiniRow(
      [
        "Job Number",
        "Fee - Expected $",
        "Contingency - Total $",
        "GR $ - B&G Sort",
      ],
      ["1", "100", "200", "300"]
    );
    expect(row.values).not.toHaveProperty("feeExpected");
    expect(row.values).not.toHaveProperty("contingencyTotal");
    expect(row.values).not.toHaveProperty("grBgSort");
  });

  it("skips empty sheet rows", () => {
    const mapped = mapDestiniSheet(
      ["Job Number", "Estimate Value $"],
      [
        ["", ""],
        ["26001", "100"],
      ]
    );
    expect(mapped).toHaveLength(1);
  });
});

describe("vertical Destini report", () => {
  const vertical: unknown[][] = [
    ["Post Bid Data Collection Destini Report"],
    [],
    [],
    ["Data Base Bid"],
    [],
    ["Data Point", "Input", "Expected Input Format", "Notes", "", "Destini"],
    ["B&G Project Attributes"],
    ["Job Number", "2600999", "Number", "Main Job Number", "C", "x"],
    ["Job Name", "Sample Tower", "Text", "", "C", "x"],
    ["Estimate Phase", "GMP", "", "Should match from the Bid Schedule"],
    ["Estimate Value $", "$12,500,000", "Dollars", "Grand Total", "C", "x"],
    ["Fee - Back Page $", "375000", "Dollars", "", "C", "x"],
    ["Fee - Expected $", "500000", "Dollars"],
    ["Craft Labor Man Hours", "48000", "Number", "", "C", "x"],
    ["PM Months (APM to PD)", "36", "Number", "", "C", "x"],
    ["GSF", "210000", "Number", "", "C", "x"],
  ];

  it("parses Data Point / Input pairs for one estimate", () => {
    const row = parseDestiniVerticalSheet(vertical);
    expect(row.jobNumber).toBe("2600999");
    expect(row.jobName).toBe("Sample Tower");
    expect(row.estimatePhase).toBe("GMP");
    expect(row.values.estimateValue).toBe(12_500_000);
    expect(row.values.feeBackPage).toBe(375_000);
    expect(row.values.craftLaborManHours).toBe(48_000);
    expect(row.values.pmMonths).toBe(36);
    expect(row.values.gsf).toBe(210_000);
    expect(row.values).not.toHaveProperty("feeExpected");
  });

  it("detects vertical format from report sheet name", () => {
    const detected = detectDestiniFormat([
      { name: "Connectivity Audit", rows: [["Current Estimate Key"]] },
      { name: "2026 Report", rows: vertical },
    ]);
    expect(detected.format).toBe("vertical");
    expect(detected.sheetName).toBe("2026 Report");
  });
});

describe("CSV parse", () => {
  it("maps a tabular CSV", () => {
    const result = parseDestiniCsv(
      "Job Number,Estimate Phase,Estimate Value $\n12345,ROM,1500000\n"
    );
    expect(result.format).toBe("tabular");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.jobNumber).toBe("12345");
    expect(result.rows[0]!.values.estimateValue).toBe(1_500_000);
  });
});

describe("Destini checksum short-circuit", () => {
  it("treats an applied checksum as idempotent", () => {
    expect(
      destiniChecksumIsApplied(
        [
          { source: "destini", checksum: "abc", status: "preview" },
          { source: "destini", checksum: "abc", status: "applied" },
        ],
        "abc"
      )
    ).toBe(true);
    expect(
      destiniChecksumIsApplied(
        [{ source: "destini", checksum: "abc", status: "preview" }],
        "abc"
      )
    ).toBe(false);
  });
});

describe("Destini preview diffs", () => {
  it("lists every proposed Destini key and marks only changed values", () => {
    const diffs = buildDestiniFieldDiffs(
      { estimateValue: 10_000_000, feeBackPage: 400_000, pmMonths: 12 },
      { estimateValue: 12_000_000, feeBackPage: 400_000, pmMonths: 18 }
    );
    expect(diffs.map((diff) => diff.key)).toEqual([
      "estimateValue",
      "feeBackPage",
      "pmMonths",
    ]);
    expect(diffs.find((diff) => diff.key === "estimateValue")?.changed).toBe(
      true
    );
    expect(diffs.find((diff) => diff.key === "feeBackPage")?.changed).toBe(
      false
    );
    expect(diffs.find((diff) => diff.key === "pmMonths")?.changed).toBe(true);
  });
});

describe("Destini local-wins identity", () => {
  it("never writes job identity or awardable amounts from Destini", () => {
    expect(DESTINI_WRITABLE_KEYS).not.toContain("jobNumber");
    expect(DESTINI_WRITABLE_KEYS).not.toContain("jobName");
    expect(DESTINI_WRITABLE_KEYS).not.toContain("awardableAmount");
    expect(DESTINI_WRITABLE_KEYS).not.toContain("contractAmountSigned");
    expect(
      filterWritableValues({
        jobNumber: "2600123",
        jobName: "Should stay local",
        awardableAmount: 1,
        estimateValue: 5_000_000,
      })
    ).toEqual({ estimateValue: 5_000_000 });
  });
});
