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
      ].join("\n"),
    );
    expect(blocks[0]).toEqual({ type: "p", text: "**Executive Region Scorecard**" });
    expect(blocks[1]).toEqual({
      type: "p",
      text: "I pulled portfolio context and drafted a page with 8 tiles.",
    });
    expect(blocks[2]).toEqual({ type: "p", text: "**Layout**" });
    expect(blocks[3]).toEqual({ type: "ul", items: ["Four KPI tiles", "Horizontal bar and donut"] });
    expect(blocks[4]).toEqual({
      type: "ol",
      items: ["**Texas is a volume outlier.**", "Central carries the most activity"],
    });
  });
});
