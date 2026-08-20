import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "schedule-modes.tsx"),
  "utf8"
);

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
