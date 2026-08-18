/**
 * Stable cursor pagination for SQL-backed lists.
 * Cursor encodes the last seen (sortValue, id) pair.
 */

export type PageCursor = {
  sortValue: string | number | null;
  id: number;
};

export type PageResult<T> = {
  items: T[];
  nextCursor: string | null;
  pageSize: number;
};

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function clampPageSize(raw: number | undefined | null): number {
  if (!raw || !Number.isFinite(raw)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(raw)));
}

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(
  raw: string | null | undefined
): PageCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as PageCursor;
    if (typeof parsed.id !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export type OffsetPage = { limit: number; offset: number };

/**
 * Parse `?limit` / `?offset` query params for offset-paginated endpoints.
 * `limit` is clamped to MAX_PAGE_SIZE; the default may be raised (up to the
 * max) for endpoints whose existing consumers expect large pages.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { limit?: number } = {}
): OffsetPage {
  const fallback = Math.min(MAX_PAGE_SIZE, defaults.limit ?? DEFAULT_PAGE_SIZE);
  const rawLimit = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(MAX_PAGE_SIZE, Math.floor(rawLimit))
      : fallback;
  const rawOffset = Number(searchParams.get("offset"));
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 1 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

export function pageFromRows<T extends { id: number }>(
  rows: T[],
  pageSize: number,
  sortValueOf: (row: T) => string | number | null
): PageResult<T> {
  const size = clampPageSize(pageSize);
  const slice = rows.slice(0, size + 1);
  const hasMore = slice.length > size;
  const items = hasMore ? slice.slice(0, size) : slice;
  const last = items[items.length - 1];
  return {
    items,
    pageSize: size,
    nextCursor:
      hasMore && last
        ? encodeCursor({ id: last.id, sortValue: sortValueOf(last) })
        : null,
  };
}
