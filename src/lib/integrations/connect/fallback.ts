/**
 * REST Connect is the preferred source. When the remote call fails (offline,
 * timeout, 5xx), fall back to the seeded mock mirror so typeahead still works.
 */
export async function withConnectMockFallback<T>(
  rest: () => Promise<T>,
  mock: () => Promise<T>
): Promise<T> {
  try {
    return await rest();
  } catch {
    return mock();
  }
}

type ConnectLookups<T> = {
  search(query: string): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  list(): Promise<T[]>;
};

/** Search, get-by-id, and daily-match list all share the same REST→mock fallback. */
export function wrapConnectLookups<T>(
  rest: ConnectLookups<T>,
  mock: ConnectLookups<T>
): ConnectLookups<T> {
  return {
    search: (query) =>
      withConnectMockFallback(
        () => rest.search(query),
        () => mock.search(query)
      ),
    getById: (id) =>
      withConnectMockFallback(
        () => rest.getById(id),
        () => mock.getById(id)
      ),
    list: () =>
      withConnectMockFallback(
        () => rest.list(),
        () => mock.list()
      ),
  };
}
