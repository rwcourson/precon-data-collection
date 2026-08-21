import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));

describe("ExportActions", () => {
  it("exposes Excel and PDF as real download links", () => {
    const source = readFileSync(path.join(dir, "export-actions.tsx"), "utf8");
    expect(source).toContain("<a href={excelHref}");
    expect(source).toContain("<a");
    expect(source).toContain("Excel");
    expect(source).toContain("PDF");
    expect(source).not.toContain("nativeButton");
  });
});
