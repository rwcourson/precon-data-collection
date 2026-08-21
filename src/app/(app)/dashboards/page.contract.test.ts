import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));

describe("dashboard export actions", () => {
  it("offers Excel and PDF of the current rollup", () => {
    const source = readFileSync(path.join(dir, "page.tsx"), "utf8");
    expect(source).toContain("ExportActions");
    expect(source).toContain("/api/export/dashboard?");
    expect(source).toContain("format=pdf");
  });
});
