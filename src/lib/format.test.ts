import { describe, expect, it } from "vitest";
import {
  caretAfterSignificant,
  displayJobNumber,
  formatNumericInput,
  parseNumericInput,
  significantNumericCount,
} from "@/lib/format";

describe("numeric input grouping", () => {
  it("renders stored TBD identities as Pending job number", () => {
    expect(displayJobNumber("TBD-1008")).toBe("Pending job number");
    expect(displayJobNumber("tbd-42")).toBe("Pending job number");
    expect(displayJobNumber("2600123")).toBe("2600123");
    expect(displayJobNumber("")).toBe("—");
  });

  it("parses pasted money into a plain number string", () => {
    expect(parseNumericInput("$992,749,827")).toBe("992749827");
    expect(parseNumericInput("21,657,290.6")).toBe("21657290.6");
    expect(parseNumericInput("  ")).toBe("");
  });

  it("keeps a trailing decimal so the user can type cents", () => {
    expect(parseNumericInput("1,234.")).toBe("1234.");
    expect(formatNumericInput("1234.")).toBe("1,234.");
  });

  it("groups thousands for display without dropping decimals", () => {
    expect(formatNumericInput("992749827")).toBe("992,749,827");
    expect(formatNumericInput("21657290.6")).toBe("21,657,290.6");
    expect(formatNumericInput("15046592.15")).toBe("15,046,592.15");
    expect(formatNumericInput("")).toBe("");
  });

  it("restores the caret after commas are inserted", () => {
    expect(significantNumericCount("992,")).toBe(3);
    expect(caretAfterSignificant("9,927", 4)).toBe(5);
  });
});
