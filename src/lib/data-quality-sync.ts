import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { dataQualityFlags } from "@/db/schema";
import { flagKey, scanRound } from "@/lib/data-quality";
import {
  getMultiValuesForRounds,
  getReferenceValues,
  getRoundsWithJobs,
} from "@/lib/queries";

export type SyncResult = {
  total: number;
  inserted: number;
  cleared: number;
  open: number;
  resolved: number;
};

/**
 * Rebuilds the review queue from current data. Existing resolutions survive: a
 * flag that still reproduces keeps its resolved state and only has `lastSeenAt`
 * bumped, and flags that no longer reproduce are deleted. Shared by the admin
 * rescan action and the Smartsheet import so the queue exists straight after a
 * migration rather than waiting for someone to press a button.
 */
export async function syncDataQualityFlags(): Promise<SyncResult> {
  const [rows, lists] = await Promise.all([getRoundsWithJobs(), getReferenceValues()]);
  const multiMap = await getMultiValuesForRounds(rows.map((r) => r.round.id));

  const scanned = rows.flatMap((r) =>
    scanRound(r.round, r.job, multiMap.get(r.round.id) ?? {}, lists),
  );
  const scannedByKey = new Map(scanned.map((f) => [flagKey(f), f]));

  const existing = await db.select().from(dataQualityFlags);
  const existingByKey = new Map(existing.map((f) => [flagKey(f), f]));

  const now = new Date();
  const toInsert = [...scannedByKey.entries()]
    .filter(([key]) => !existingByKey.has(key))
    .map(([, f]) => ({ ...f, firstSeenAt: now, lastSeenAt: now }));

  const stillPresentIds = existing.filter((f) => scannedByKey.has(flagKey(f))).map((f) => f.id);
  const staleIds = existing.filter((f) => !scannedByKey.has(flagKey(f))).map((f) => f.id);

  // Chunked because a first-time scan of an imported history can be large.
  for (let i = 0; i < toInsert.length; i += 500) {
    await db.insert(dataQualityFlags).values(toInsert.slice(i, i + 500));
  }
  for (let i = 0; i < stillPresentIds.length; i += 500) {
    await db
      .update(dataQualityFlags)
      .set({ lastSeenAt: now })
      .where(inArray(dataQualityFlags.id, stillPresentIds.slice(i, i + 500)));
  }
  for (let i = 0; i < staleIds.length; i += 500) {
    await db
      .delete(dataQualityFlags)
      .where(inArray(dataQualityFlags.id, staleIds.slice(i, i + 500)));
  }

  const after = await db.select().from(dataQualityFlags);
  return {
    total: scannedByKey.size,
    inserted: toInsert.length,
    cleared: staleIds.length,
    open: after.filter((f) => f.resolvedAt == null).length,
    resolved: after.filter((f) => f.resolvedAt != null).length,
  };
}
