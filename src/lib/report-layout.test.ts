import { describe, expect, it } from "vitest";
import type { ReportFieldDef } from "@/lib/report-engine";
import { reportColumnMeta, reportColumnWidth } from "@/lib/report-layout";

const catalog: ReportFieldDef[] = [
  { key: "region", label: "Region", type: "dropdown", category: "Identity" },
  { key: "jobName", label: "Job Name", type: "text", category: "Identity" },
  {
    key: "estimatePhase",
    label: "Estimate Phase",
    type: "dropdown",
    category: "Identity",
  },
  {
    key: "estimateValue",
    label: "Bid Amount",
    type: "dollars",
    category: "Identity",
  },
];

const columns = catalog.map((c) => ({ key: c.key }));

describe("report column layout", () => {
  it("gives leftover width to the job name instead of a middle gap", () => {
    expect(reportColumnWidth("jobName", columns, catalog)).toMatch(/%$/);
    expect(reportColumnWidth("region", columns, catalog)).toBe("11rem");
    expect(reportColumnWidth("estimateValue", columns, catalog)).toBe("7.5rem");
    expect(reportColumnMeta("estimateValue", catalog).numeric).toBe(true);
  });
});
