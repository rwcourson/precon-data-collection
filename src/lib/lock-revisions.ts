export function nextLockRevisionNumber(existingRevisions: number[]): number {
  return Math.max(0, ...existingRevisions) + 1;
}

export type LockRevisionFieldDiff = {
  field: string;
  from: string;
  to: string;
};

const SKIP = new Set([
  "id",
  "jobId",
  "createdById",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "job",
  "estimateLeadName",
  "multiValues",
  "policyVersion",
]);

function printable(value: unknown): string {
  if (value == null) return "—";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Field diffs between consecutive lock snapshots for the History tab. */
export function lockRevisionFieldDiffs(
  previous: Record<string, unknown> | null | undefined,
  current: Record<string, unknown>
): LockRevisionFieldDiff[] {
  const keys = new Set([
    ...Object.keys(previous ?? {}),
    ...Object.keys(current),
  ]);
  return [...keys]
    .filter((key) => !SKIP.has(key) && !key.startsWith("_"))
    .flatMap((field) => {
      const from = printable(previous?.[field]);
      const to = printable(current[field]);
      return from === to ? [] : [{ field, from, to }];
    });
}
