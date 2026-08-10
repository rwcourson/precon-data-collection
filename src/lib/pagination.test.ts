import { describe, expect, it } from "vitest";
import {
  clampPageSize,
  decodeCursor,
  encodeCursor,
  MAX_PAGE_SIZE,
  pageFromRows,
} from "@/lib/pagination";

describe("pagination", () => {
  it("clamps page size to the export budget", () => {
    expect(clampPageSize(0)).toBe(50);
    expect(clampPageSize(5000)).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize(25)).toBe(25);
  });

  it("encodes and decodes stable cursors", () => {
    const encoded = encodeCursor({ id: 42, sortValue: "Central" });
    expect(decodeCursor(encoded)).toEqual({ id: 42, sortValue: "Central" });
    expect(decodeCursor("not-a-cursor")).toBeNull();
  });

  it("pages rows with a next cursor when more remain", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `r${i}` }));
    const page = pageFromRows(rows, 2, (row) => row.name);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeTruthy();
    const cursor = decodeCursor(page.nextCursor);
    expect(cursor?.id).toBe(2);
  });
});
