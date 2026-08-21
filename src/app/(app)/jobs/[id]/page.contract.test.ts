import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));

describe("job access vs round team", () => {
  it("keeps job access as visibility, not a region-wide team roster", () => {
    const page = readFileSync(path.join(dir, "page.tsx"), "utf8");
    expect(page).toContain("Who can see this");
    expect(page).toContain("estimate round");
    expect(page).toContain("Estimate Lead");
    const editor = readFileSync(
      path.join(dir, "../../../../components/jobs/regions-editor.tsx"),
      "utf8"
    );
    expect(editor).toContain("Visible in");
    expect(editor).toContain("Added individually");
    expect(editor).not.toContain(
      "Everyone in a visible region can already see"
    );
    expect(editor).not.toMatch(/SECTION_LABEL\}>Team/);
  });
});
