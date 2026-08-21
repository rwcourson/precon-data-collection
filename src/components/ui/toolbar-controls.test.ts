import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  toolbarSegmentClass,
  toolbarSegmentedClass,
  toolbarSelectClass,
} from "./toolbar-controls";

const dir = path.dirname(fileURLToPath(import.meta.url));

describe("toolbar controls", () => {
  it("keeps chips, selects, and the track on the same compact size", () => {
    expect(toolbarSelectClass).toContain("h-7");
    expect(toolbarSelectClass).toContain("text-xs");
    expect(toolbarSegmentedClass).toContain("h-7");
    expect(toolbarSegmentClass(true)).toContain("text-xs");
    expect(toolbarSegmentClass(true)).toContain("h-full");
  });

  it("is what Bid Schedule and View toggles use", () => {
    const schedule = readFileSync(
      path.join(dir, "../../app/(app)/bid-schedule/page.tsx"),
      "utf8"
    );
    expect(schedule).toContain("ToolbarField");
    expect(schedule).toContain("ToolbarSegmented");
    const toggle = readFileSync(
      path.join(dir, "../rounds/form-sheet-toggle.tsx"),
      "utf8"
    );
    expect(toggle).toContain("ToolbarSegmented");
  });
});
