import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));

function source(relative: string) {
  return readFileSync(path.join(dir, relative), "utf8");
}

describe("form/sheet view alternative", () => {
  it("uses the shared cell write path on the round sheet", () => {
    const sheet = source("round-entry-sheet.tsx");
    expect(sheet).toContain("updateRoundCell");
    expect(sheet).toContain("DataGrid");
    expect(sheet).toContain("filterSheetColumnsBySection");
  });

  it("exposes Form and Sheet on the estimate-round page", () => {
    const page = readFileSync(
      path.join(dir, "../../app/(app)/rounds/[id]/page.tsx"),
      "utf8"
    );
    expect(page).toContain("FormSheetToggle");
    expect(page).toContain("RoundEntrySheet");
    expect(page).toContain("SectionFilter");
    expect(page).toContain("parseEntryViewMode");
  });

  it("keeps the round team on the estimate-round page", () => {
    const page = readFileSync(
      path.join(dir, "../../app/(app)/rounds/[id]/page.tsx"),
      "utf8"
    );
    expect(page).toContain("StaffingCard");
    expect(page).toContain("estimateLeadName={estimateLeadName}");
  });

  it("lets sheet and form dropdowns clear with None", () => {
    const editor = source("../sheets/cell-editor.tsx");
    expect(editor).toContain("dropdownCommitValue");
    expect(editor).toContain("DropdownSelectOptions");
    const form = source("entry-form.tsx");
    expect(form).toContain("dropdownCommitValue");
    expect(form).toContain("DropdownSelectOptions");
  });

  it("exposes Queue and Sheet on the post-bid form queue", () => {
    const page = readFileSync(
      path.join(dir, "../../app/(app)/post-bid/page.tsx"),
      "utf8"
    );
    expect(page).toContain("FormSheetToggle");
    expect(page).toContain("RoundEntrySheet");
    expect(page).toContain("SectionFilter");
    expect(page).toContain('formLabel="Queue"');
    expect(page).toContain('mode: "postBid"');
  });
});
