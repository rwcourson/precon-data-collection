import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "schedule-modes.tsx"),
  "utf8"
);

describe("schedule cards", () => {
  it("keeps even inset padding and does not stretch cards in a row", () => {
    expect(source).toContain("grid items-start gap-4");
    expect(source).toContain("[--card-spacing:--spacing(5)]");
    expect(source).toContain("CardHeader className=\"gap-3\"");
    expect(source).not.toContain("gap-2 pb-2");
  });
});

describe("Gantt date-edit seam", () => {
  it("uses the conflict-safe cell mutation and never auto-slides people", () => {
    expect(source).toContain(
      'RESOURCE_MANAGEMENT_EVENT = "resource.bar.future"'
    );
    expect(source).toContain("updateRoundCell");
    expect(source).toContain("effort.updatedAt");
    expect(source).not.toMatch(/autoSlidePeople:\s*true/);
  });
});
