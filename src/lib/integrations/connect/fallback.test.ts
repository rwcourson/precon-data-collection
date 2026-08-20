import { describe, expect, it } from "vitest";
import { withConnectMockFallback, wrapConnectLookups } from "./fallback";

describe("Connect REST offline fallback", () => {
  it("returns REST results when the remote call succeeds", async () => {
    await expect(
      withConnectMockFallback(
        async () => [{ sfId: "rest" }],
        async () => [{ sfId: "mock" }]
      )
    ).resolves.toEqual([{ sfId: "rest" }]);
  });

  it("uses the mock mirror when REST throws", async () => {
    await expect(
      withConnectMockFallback(
        async () => {
          throw new Error("B&G Connect responded 503");
        },
        async () => [{ sfId: "mock" }]
      )
    ).resolves.toEqual([{ sfId: "mock" }]);
  });

  it("falls back for search, get-by-id, and daily-match list", async () => {
    const rest = {
      search: async () => {
        throw new Error("B&G Connect responded 503");
      },
      getById: async () => {
        throw new Error("B&G Connect responded 503");
      },
      list: async () => {
        throw new Error("B&G Connect responded 503");
      },
    };
    const mock = {
      search: async () => [{ sfId: "search-mock" }],
      getById: async () => ({ sfId: "id-mock" }),
      list: async () => [{ sfId: "list-mock" }],
    };
    const wrapped = wrapConnectLookups(rest, mock);
    await expect(wrapped.search("tower")).resolves.toEqual([
      { sfId: "search-mock" },
    ]);
    await expect(wrapped.getById("SF-1")).resolves.toEqual({
      sfId: "id-mock",
    });
    await expect(wrapped.list()).resolves.toEqual([{ sfId: "list-mock" }]);
  });
});
