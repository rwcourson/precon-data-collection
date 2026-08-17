import { db } from "@/db";
import {
  customColumnValues,
  customColumns,
  estimateRounds,
  jobRegionVisibility,
  jobs,
  roundMultiValues,
  users,
} from "@/db/schema";
import type { CustomColumn, EstimateRound, Job } from "@/db/schema";
import type { Workspace } from "./workspace";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

export type RoundRow = {
  round: EstimateRound;
  job: Job;
  estimateLeadName: string | null;
};

/**
 * All rounds joined with their job + estimate lead name. When a Region
 * workspace is active the filter is applied in SQL against job visibility
 * rows (not the denormalized round.region grouping column).
 */
export async function getRoundsWithJobs(workspace?: Workspace): Promise<RoundRow[]> {
  const filters = [
    isNull(estimateRounds.deletedAt),
    isNull(jobs.deletedAt),
    ...(workspace?.region
      ? [
          sql<boolean>`exists (
            select 1 from ${jobRegionVisibility}
            where ${eq(jobRegionVisibility.jobId, jobs.id)}
              and ${eq(jobRegionVisibility.region, workspace.region)}
          )`,
        ]
      : []),
  ];
  const rows = await db
    .select({
      round: estimateRounds,
      job: jobs,
      estimateLeadName: users.name,
    })
    .from(estimateRounds)
    .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
    .leftJoin(users, eq(estimateRounds.estimateLeadId, users.id))
    .where(and(...filters));
  return rows;
}

export async function getRoundWithJob(roundId: number): Promise<RoundRow | null> {
  const rows = await db
    .select({ round: estimateRounds, job: jobs, estimateLeadName: users.name })
    .from(estimateRounds)
    .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
    .leftJoin(users, eq(estimateRounds.estimateLeadId, users.id))
    .where(eq(estimateRounds.id, roundId));
  return rows[0] ?? null;
}

/** Multi-value field entries for a round, grouped by field key. */
export async function getMultiValues(roundId: number): Promise<Record<string, string[]>> {
  const rows = await db
    .select()
    .from(roundMultiValues)
    .where(eq(roundMultiValues.roundId, roundId));
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    (out[r.field] ??= []).push(r.value);
  }
  return out;
}

/** Multi-values for many rounds at once: roundId -> field -> values. */
export async function getMultiValuesForRounds(
  roundIds: number[],
): Promise<Map<number, Record<string, string[]>>> {
  const out = new Map<number, Record<string, string[]>>();
  if (roundIds.length === 0) return out;
  const rows = await db
    .select()
    .from(roundMultiValues)
    .where(inArray(roundMultiValues.roundId, roundIds));
  for (const r of rows) {
    const rec = out.get(r.roundId) ?? {};
    (rec[r.field] ??= []).push(r.value);
    out.set(r.roundId, rec);
  }
  return out;
}

export async function getAllCustomColumns(): Promise<CustomColumn[]> {
  return db.select().from(customColumns).orderBy(asc(customColumns.id));
}

/** Custom column values for many rounds: roundId -> columnId -> value. */
export async function getCustomValuesForRounds(
  roundIds: number[],
): Promise<Map<number, Record<number, string | null>>> {
  const out = new Map<number, Record<number, string | null>>();
  if (roundIds.length === 0) return out;
  const rows = await db
    .select()
    .from(customColumnValues)
    .where(inArray(customColumnValues.roundId, roundIds));
  for (const r of rows) {
    const rec = out.get(r.roundId) ?? {};
    rec[r.columnId] = r.value;
    out.set(r.roundId, rec);
  }
  return out;
}

/** Reference list values (active only), keyed by list. */
export async function getReferenceValues(): Promise<Record<string, string[]>> {
  const rows = await db.query.referenceListValues.findMany({
    orderBy: (v, { asc: a }) => [a(v.sortOrder)],
  });
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    if (!r.retired) (out[r.listKey] ??= []).push(r.value);
  }
  return out;
}
