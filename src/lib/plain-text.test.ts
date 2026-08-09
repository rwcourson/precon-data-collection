import { describe, expect, it } from "vitest";
import { toPlainText } from "./plain-text";

describe("toPlainText", () => {
  it("strips bold, lists, and headings", () => {
    const raw = `**Not available in this snapshot.**

- **Central**: $31.0B
1. First item

## Heading
Plain sentence.`;
    const plain = toPlainText(raw);
    expect(plain).not.toMatch(/\*\*/);
    expect(plain).not.toMatch(/^#/m);
    expect(plain).toContain("Not available in this snapshot.");
    expect(plain).toContain("Central");
    expect(plain).toContain("Plain sentence.");
  });

  it("unwraps links and code", () => {
    expect(toPlainText("See [docs](https://example.com) and `winRate`.")).toBe(
      "See docs and winRate.",
    );
  });
});
