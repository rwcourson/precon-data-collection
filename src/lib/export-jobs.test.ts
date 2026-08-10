import { describe, expect, it } from "vitest";
import { SYNC_EXPORT_ROW_LIMIT, shouldExportAsync } from "@/lib/export-jobs";

describe("export job thresholds", () => {
  it("keeps small exports synchronous", () => {
    expect(shouldExportAsync(100, 1024)).toBe(false);
    expect(shouldExportAsync(SYNC_EXPORT_ROW_LIMIT, 1024)).toBe(false);
  });

  it("forces large exports asynchronous", () => {
    expect(shouldExportAsync(SYNC_EXPORT_ROW_LIMIT + 1, 1024)).toBe(true);
    expect(shouldExportAsync(10, 26 * 1024 * 1024)).toBe(true);
  });
});
