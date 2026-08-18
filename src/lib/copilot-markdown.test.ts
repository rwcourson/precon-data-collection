import { describe, expect, it } from "vitest";
import { parseCopilotMarkdown } from "@/components/copilot/copilot-markdown";

describe("copilot markdown", () => {
  it("turns bold titles, bullets, and numbered insights into blocks", () => {
    const blocks = parseCopilotMarkdown(
      [
        "**Executive Region Scorecard**",
        "",
        "I pulled portfolio context and drafted a page with 8 tiles.",
        "",
        "**Layout**",
        "- Four KPI tiles",
        "- Horizontal bar and donut",
        "",
        "1. **Texas is a volume outlier.**",
        "2. Central carries the most activity",
      ].join("\n")
    );
    expect(blocks[0]).toEqual({
      type: "p",
      text: "**Executive Region Scorecard**",
    });
    expect(blocks[1]).toEqual({
      type: "p",
      text: "I pulled portfolio context and drafted a page with 8 tiles.",
    });
    expect(blocks[2]).toEqual({ type: "p", text: "**Layout**" });
    expect(blocks[3]).toEqual({
      type: "ul",
      items: ["Four KPI tiles", "Horizontal bar and donut"],
    });
    expect(blocks[4]).toEqual({
      type: "ol",
      items: [
        "**Texas is a volume outlier.**",
        "Central carries the most activity",
      ],
    });
  });

  it("keeps markdown tables as their own block instead of a pipe paragraph", () => {
    const blocks = parseCopilotMarkdown(
      [
        "**37 upcoming rounds have no team assigned**",
        "",
        "*Highest risk — no estimate lead and no team:*",
        "| Job # | Job | Dept | Bid due |",
        "| -- | -- | -- | -- |",
        "| 4012 | AH Sebring 4th Floor Buildout | ORL MED | 8/28/26 |",
        "| 4018 | St. Vincent’s Clay County Sterilizer Replacement | JAX | 9/4/26 |",
        "",
        "Next up by bid date:",
      ].join("\n")
    );
    expect(blocks[0]).toEqual({
      type: "p",
      text: "**37 upcoming rounds have no team assigned**",
    });
    expect(blocks[1]).toEqual({
      type: "p",
      text: "*Highest risk — no estimate lead and no team:*",
    });
    expect(blocks[2]).toEqual({
      type: "table",
      headers: ["Job #", "Job", "Dept", "Bid due"],
      rows: [
        ["4012", "AH Sebring 4th Floor Buildout", "ORL MED", "8/28/26"],
        [
          "4018",
          "St. Vincent’s Clay County Sterilizer Replacement",
          "JAX",
          "9/4/26",
        ],
      ],
    });
    expect(blocks[3]).toEqual({ type: "p", text: "Next up by bid date:" });
  });

  it("restores tables that arrived as one pipe-joined line", () => {
    const blocks = parseCopilotMarkdown(
      "*Highest risk:* | Job # | Job | Dept | Bid due | | -- | -- | -- | -- | | 26879 | AH Sebring 4th Floor Buildout | ORL MED | - |"
    );
    expect(blocks[0]).toEqual({ type: "p", text: "*Highest risk:*" });
    expect(blocks[1]).toEqual({
      type: "table",
      headers: ["Job #", "Job", "Dept", "Bid due"],
      rows: [["26879", "AH Sebring 4th Floor Buildout", "ORL MED", "-"]],
    });
  });
});
