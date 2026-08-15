import { describe, expect, it } from "vitest";
import { dropPlaceForPoint, moveColumnKey } from "@/lib/sheet-grid";

describe("moveColumnKey", () => {
  const keys = ["a", "b", "c", "d"];

  it("moves a column before another", () => {
    expect(moveColumnKey(keys, "d", "b", "before")).toEqual(["a", "d", "b", "c"]);
  });

  it("moves a column after another", () => {
    expect(moveColumnKey(keys, "a", "c", "after")).toEqual(["b", "c", "a", "d"]);
  });

  it("is a no-op when the keys match or are missing", () => {
    expect(moveColumnKey(keys, "a", "a", "after")).toEqual(keys);
    expect(moveColumnKey(keys, "z", "a", "before")).toEqual(keys);
  });
});

describe("dropPlaceForPoint", () => {
  const rect = { left: 100, width: 80 } as DOMRect;

  it("drops before the midpoint and after it", () => {
    expect(dropPlaceForPoint(110, rect)).toBe("before");
    expect(dropPlaceForPoint(150, rect)).toBe("after");
  });
});
