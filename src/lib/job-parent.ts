/** Pure parent/child cycle check. Walks existing child→parent edges. */
export function parentWouldCycle(
  childJobId: number,
  parentJobId: number,
  parents: ReadonlyMap<number, number>
): boolean {
  if (parentJobId === childJobId) return true;
  const seen = new Set<number>();
  let cursor: number | undefined = parentJobId;
  while (cursor != null) {
    if (cursor === childJobId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parents.get(cursor);
  }
  return false;
}
