type ProjectionRow = {
  job: { id: number };
  round: {
    id: number;
    status: string;
    bidDueDate: string | null;
    roundNumber: number;
  };
};

export type ProjectedScheduleJob<T extends ProjectionRow> = {
  jobId: number;
  focal: T;
  efforts: T[];
};

const STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  upcoming: 1,
  outstanding: 2,
};

function compareEfforts<T extends ProjectionRow>(a: T, b: T): number {
  const status =
    (STATUS_PRIORITY[a.round.status] ?? 99) -
    (STATUS_PRIORITY[b.round.status] ?? 99);
  if (status !== 0) return status;
  const due = (a.round.bidDueDate ?? "9999-99-99").localeCompare(
    b.round.bidDueDate ?? "9999-99-99"
  );
  if (due !== 0) return due;
  if (a.round.roundNumber !== b.round.roundNumber)
    return b.round.roundNumber - a.round.roundNumber;
  return a.round.id - b.round.id;
}

/**
 * One deterministic board row per job. `eligibleRows` defines the visible
 * section/filter; `allRows` supplies the complete effort list for its popover.
 */
export function projectScheduleJobs<T extends ProjectionRow>(
  eligibleRows: T[],
  allRows: T[] = eligibleRows
): ProjectedScheduleJob<T>[] {
  const eligibleByJob = new Map<number, T[]>();
  for (const row of eligibleRows) {
    const group = eligibleByJob.get(row.job.id) ?? [];
    group.push(row);
    eligibleByJob.set(row.job.id, group);
  }
  const allByJob = new Map<number, T[]>();
  for (const row of allRows) {
    if (!eligibleByJob.has(row.job.id)) continue;
    const group = allByJob.get(row.job.id) ?? [];
    group.push(row);
    allByJob.set(row.job.id, group);
  }

  return [...eligibleByJob.entries()]
    .map(([jobId, eligible]) => ({
      jobId,
      focal: [...eligible].sort(compareEfforts)[0],
      efforts: [...(allByJob.get(jobId) ?? eligible)].sort(compareEfforts),
    }))
    .sort((a, b) => compareEfforts(a.focal, b.focal));
}

/** Compact an export/report row set to the same one-job grain as the board. */
export function compactFlatScheduleRows<T extends Record<string, unknown>>(
  rows: T[]
): T[] {
  const byJob = new Map<string, T[]>();
  for (const row of rows) {
    const key = String(row.jobId ?? row.jobNumber ?? row.jobName ?? "");
    const group = byJob.get(key) ?? [];
    group.push(row);
    byJob.set(key, group);
  }
  const statusPriority: Record<string, number> = {
    active: 0,
    Active: 0,
    upcoming: 1,
    Upcoming: 1,
    outstanding: 2,
    Outstanding: 2,
  };
  return [...byJob.values()].map(
    (group) =>
      [...group].sort((a, b) => {
        const status =
          (statusPriority[String(a.status)] ?? 99) -
          (statusPriority[String(b.status)] ?? 99);
        if (status !== 0) return status;
        const due = String(a.bidDueDate ?? "9999-99-99").localeCompare(
          String(b.bidDueDate ?? "9999-99-99")
        );
        if (due !== 0) return due;
        return Number(b.roundNumber ?? 0) - Number(a.roundNumber ?? 0);
      })[0]
  );
}

/** TI/sub-jobs stay on the parent job page and do not duplicate the board. */
export function excludeChildJobRows<T extends { job: { id: number } }>(
  rows: T[],
  childJobIds: Iterable<number>
): T[] {
  const children = new Set(childJobIds);
  if (children.size === 0) return rows;
  return rows.filter((row) => !children.has(row.job.id));
}
