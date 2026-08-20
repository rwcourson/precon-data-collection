export function publicationRevisionFromPayload(
  payload: { revision?: unknown } | null | undefined
): number | null {
  const revision = Number(payload?.revision);
  return Number.isFinite(revision) && revision > 0 ? revision : null;
}

export function retractLockedRevisionSql(
  table: string,
  roundId: number,
  revision: number
): string {
  return `UPDATE ${table} SET status = 'retracted' WHERE round_id = ${roundId} AND lock_revision = ${revision}`;
}

export type LockedShadowRow = {
  round_id: number;
  lock_revision: number;
  status: string;
};

export type LockedPublicationEvent = {
  type: "publish" | "retract";
  roundId: number;
  revision: number;
};

/**
 * In-memory model of the warehouse MERGE/retract semantics. Applying the same
 * event twice is identity; unlocked/retracted rows drop out of the current view.
 */
export function applyLockedPublication(
  store: LockedShadowRow[],
  event: LockedPublicationEvent
): LockedShadowRow[] {
  if (event.type === "retract") {
    return store.map((row) =>
      row.round_id === event.roundId && row.lock_revision === event.revision
        ? { ...row, status: "retracted" }
        : row
    );
  }
  const without = store.filter(
    (row) =>
      !(row.round_id === event.roundId && row.lock_revision === event.revision)
  );
  return [
    ...without,
    {
      round_id: event.roundId,
      lock_revision: event.revision,
      status: "locked",
    },
  ];
}

export function currentLockedShadowView(
  store: LockedShadowRow[]
): LockedShadowRow[] {
  return store.filter((row) => row.status === "locked");
}

export function warehouseProductEventName(
  eventType: string
): "warehouse.published" | "warehouse.retracted" | null {
  if (eventType === "retract") return "warehouse.retracted";
  if (eventType === "publish") return "warehouse.published";
  return null;
}

export function mergeOnRoundAndRevisionSql(
  table: string,
  columns: string[],
  sourceSelect: string
): string {
  const updates = columns
    .filter((column) => column !== "round_id" && column !== "lock_revision")
    .map((column) => `${column} = source.${column}`)
    .join(", ");
  return `MERGE INTO ${table} AS target
       USING (${sourceSelect}) AS source
       ON target.round_id = source.round_id AND target.lock_revision = source.lock_revision
       WHEN MATCHED THEN UPDATE SET ${updates}
       WHEN NOT MATCHED THEN INSERT (${columns.join(", ")})
       VALUES (${columns.map((column) => `source.${column}`).join(", ")})`;
}
