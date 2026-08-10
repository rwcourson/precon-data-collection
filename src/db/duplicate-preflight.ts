import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type DuplicateGroup = {
  table: string;
  key: string;
  count: number;
  keepId: number;
  dropIds: number[];
};

/**
 * Detect logical duplicates that would block unique constraints.
 * Resolution keeps the lowest id (oldest row) and returns drop candidates —
 * callers must review before applying destructive cleanup.
 */
export async function analyzeLogicalDuplicates(): Promise<{
  groups: DuplicateGroup[];
  clean: boolean;
}> {
  const groups: DuplicateGroup[] = [];

  for (const row of await queryGroups(sql`
    select column_id as "columnId", round_id as "roundId",
           array_agg(id order by id) as ids
    from custom_column_values
    group by column_id, round_id
    having count(*) > 1
  `)) {
    const ids = parseIdArray(row.ids);
    groups.push({
      table: "custom_column_values",
      key: `${row.columnId}:${row.roundId}`,
      count: ids.length,
      keepId: ids[0]!,
      dropIds: ids.slice(1),
    });
  }

  for (const row of await queryGroups(sql`
    select sheet_id as "sheetId", user_id as "userId",
           array_agg(id order by id) as ids
    from sheet_pins
    group by sheet_id, user_id
    having count(*) > 1
  `)) {
    const ids = parseIdArray(row.ids);
    groups.push({
      table: "sheet_pins",
      key: `${row.sheetId}:${row.userId}`,
      count: ids.length,
      keepId: ids[0]!,
      dropIds: ids.slice(1),
    });
  }

  for (const row of await queryGroups(sql`
    select distribution_list_id as "listId", period_key as "periodKey",
           array_agg(id order by id) as ids
    from distribution_runs
    group by distribution_list_id, period_key
    having count(*) > 1
  `)) {
    const ids = parseIdArray(row.ids);
    groups.push({
      table: "distribution_runs",
      key: `${row.listId}:${row.periodKey}`,
      count: ids.length,
      keepId: ids[0]!,
      dropIds: ids.slice(1),
    });
  }

  for (const row of await queryGroups(sql`
    select entity_type as "entityType", entity_id as "entityId", version,
           array_agg(id order by id) as ids
    from entity_versions
    group by entity_type, entity_id, version
    having count(*) > 1
  `)) {
    const ids = parseIdArray(row.ids);
    groups.push({
      table: "entity_versions",
      key: `${row.entityType}:${row.entityId}:${row.version}`,
      count: ids.length,
      keepId: ids[0]!,
      dropIds: ids.slice(1),
    });
  }

  return { groups, clean: groups.length === 0 };
}

/** Apply preflight resolution: drop duplicate rows, keeping the oldest id. */
export async function resolveLogicalDuplicates(groups: DuplicateGroup[]): Promise<number> {
  let dropped = 0;
  for (const group of groups) {
    if (group.dropIds.length === 0) continue;
    await db.execute(
      sql`delete from ${sql.raw(group.table)} where id in (${sql.join(
        group.dropIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    dropped += group.dropIds.length;
  }
  return dropped;
}

async function queryGroups(query: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: Record<string, unknown>[] }).rows ?? [];
  }
  return [];
}

function parseIdArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === "string") {
    return value
      .replace(/[{}]/g, "")
      .split(",")
      .filter(Boolean)
      .map((part) => Number(part.trim()));
  }
  return [];
}
