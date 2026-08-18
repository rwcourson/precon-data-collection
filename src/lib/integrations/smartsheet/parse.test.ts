import { describe, expect, it } from "vitest";
import {
  mergeSmartsheetDrafts,
  parseSheetDate,
  parseSmartsheetRound,
  smartsheetRowToCells,
} from "./parse";

const CEN_ACTIVE = "CEN_Precon_Data_CEN_Bid_Schedule_Post_Bid_Data_Collection__CEN_CBG_Bid_Schedule_-_Active__4432048245657476.json";

describe("parseSheetDate", () => {
  it("keeps ISO dates and normalizes M/D/YYYY without UTC shift", () => {
    expect(parseSheetDate("2026-03-15")).toBe("2026-03-15");
    expect(parseSheetDate("3/15/2026")).toBe("2026-03-15");
    expect(parseSheetDate("03/02/2026")).toBe("2026-03-02");
  });
});

describe("parseSmartsheetRound", () => {
  it("maps Owner, Drawings Due Date, and Bid Review Date from bid-schedule titles", () => {
    const draft = parseSmartsheetRound(
      {
        "Job #": "24150",
        "Job Name": "St. Thomas Midtown Expansion",
        Owner: "HCA Healthcare",
        "Drawings Due Date": "3/15/2026",
        "Bid Review Date": "4/1/2026",
        "Bid Date": "4/15/2026",
        "Estimate Phase": "GMP",
        Region: "Central",
        Division: "Central Building Group",
        "Lead Precon Manager": "Jay McDaniels",
        "Procurement Method": "Negotiated",
        "Design Delivery": "Design-Bid-Build",
        "Bid Amount": "$42,000,000",
        Status: "Active",
      },
      CEN_ACTIVE,
    );

    expect(draft).not.toBeNull();
    expect(draft!.owner).toBe("HCA Healthcare");
    expect(draft!.drawingsDueDate).toBe("2026-03-15");
    expect(draft!.bidReviewDate).toBe("2026-04-01");
    expect(draft!.bidDueDate).toBe("2026-04-15");
    expect(draft!.designContract).toBe("Design-Bid-Build");
    expect(draft!.estimateValue).toBe(42_000_000);
    expect(draft!.status).toBe("active");
    expect(draft!.region).toBe("Central");
  });

  it("reads the same columns from a Smartsheet columnId/cell payload", () => {
    const sheet = {
      columns: [
        { id: 1, title: "Job #" },
        { id: 2, title: "Job Name" },
        { id: 3, title: "Owner" },
        { id: 4, title: "Drawings Due Date" },
        { id: 5, title: "Bid Review Date" },
        { id: 6, title: "Estimate Phase" },
      ],
    };
    const row = {
      cells: [
        { columnId: 1, displayValue: "25001" },
        { columnId: 2, displayValue: "Auburn Arena" },
        { columnId: 3, displayValue: "Auburn University" },
        { columnId: 4, displayValue: "2026-05-10" },
        { columnId: 5, displayValue: "2026-05-20" },
        { columnId: 6, displayValue: "Budget - SD" },
      ],
    };
    const draft = parseSmartsheetRound(smartsheetRowToCells(sheet, row), CEN_ACTIVE);
    expect(draft?.owner).toBe("Auburn University");
    expect(draft?.drawingsDueDate).toBe("2026-05-10");
    expect(draft?.bidReviewDate).toBe("2026-05-20");
  });

  it("skips totals / header-looking rows", () => {
    expect(
      parseSmartsheetRound(
        { "Job #": "1", "Job Name": "Active Pursuits" },
        CEN_ACTIVE,
      ),
    ).toBeNull();
  });

  it("treats an unchecked boolean as blank, never the string \"false\"", () => {
    const unchecked = parseSmartsheetRound(
      {
        "Job #": "24151",
        "Job Name": "Boolean subject",
        "Internal Joint Venture?": false,
      },
      CEN_ACTIVE,
    );
    expect(unchecked!.internalJointVenture).toBeNull();

    const checked = parseSmartsheetRound(
      {
        "Job #": "24151",
        "Job Name": "Boolean subject",
        "Internal Joint Venture?": true,
      },
      CEN_ACTIVE,
    );
    expect(checked!.internalJointVenture).toBe("true");
  });

  it("does not fall back to the lifecycle Status column for statusAtPricing", () => {
    const draft = parseSmartsheetRound(
      {
        "Job #": "24152",
        "Job Name": "Pricing status subject",
        Status: "Active",
      },
      CEN_ACTIVE,
    );
    expect(draft!.statusAtPricing).toBeNull();

    const explicit = parseSmartsheetRound(
      {
        "Job #": "24152",
        "Job Name": "Pricing status subject",
        Status: "Active",
        "Contract Status (at time of pricing)": "Contracted",
      },
      CEN_ACTIVE,
    );
    expect(explicit!.statusAtPricing).toBe("Contracted");
  });
});

describe("mergeSmartsheetDrafts", () => {
  it("fills Owner and operational dates from the schedule row when metrics omit them", () => {
    const schedule = parseSmartsheetRound(
      {
        "Job #": "24150",
        "Job Name": "St. Thomas Midtown Expansion",
        Owner: "HCA Healthcare",
        "Drawings Due Date": "2026-03-15",
        "Bid Review Date": "2026-04-01",
        "Estimate Phase": "GMP",
        Status: "Active",
      },
      CEN_ACTIVE,
    )!;
    const metrics = parseSmartsheetRound(
      {
        "Job #": "24150",
        "Job Name": "St. Thomas Midtown Expansion",
        "Estimate Phase": "GMP",
        "Estimate Value $": "42000000",
        Outcome: "Pending",
      },
      "CEN_Estimate_Metrics_Capture.json",
    )!;
    const merged = mergeSmartsheetDrafts(schedule, metrics);
    expect(merged.owner).toBe("HCA Healthcare");
    expect(merged.drawingsDueDate).toBe("2026-03-15");
    expect(merged.bidReviewDate).toBe("2026-04-01");
    expect(merged.estimateValue).toBe(42_000_000);
  });
});
