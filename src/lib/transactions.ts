import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, type AppDb } from "@/db";
import { estimateRounds } from "@/db/schema";
import { DomainError } from "@/domain/errors";

export type TransactionalDb = AppDb;

/** Run work in a single transaction. The callback receives the same AppDb surface. */
export async function withTransaction<T>(
  work: (tx: TransactionalDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (raw) => work(raw as unknown as TransactionalDb));
}

/**
 * Optimistic concurrency guard: update only when the row still matches the
 * expected status/updatedAt snapshot the caller loaded.
 */
export async function updateRoundIfUnchanged(
  tx: TransactionalDb,
  input: {
    roundId: number;
    expectedStatus: string;
    expectedUpdatedAt: Date;
    patch: Record<string, unknown>;
  },
): Promise<void> {
  const [updated] = await tx
    .update(estimateRounds)
    .set({ ...input.patch, updatedAt: new Date() })
    .where(
      and(
        eq(estimateRounds.id, input.roundId),
        eq(estimateRounds.status, input.expectedStatus as never),
        // Postgres `now()` keeps microseconds; JS Date only carries milliseconds,
        // so a strict equality never matches rows whose updated_at came from the
        // column default. Compare both sides at millisecond precision.
        sql`date_trunc('milliseconds', ${estimateRounds.updatedAt}) = date_trunc('milliseconds', ${sql.param(input.expectedUpdatedAt, estimateRounds.updatedAt)}::timestamp)`,
      ),
    )
    .returning({ id: estimateRounds.id });
  if (!updated) {
    throw DomainError.conflict(
      "This record changed since you loaded it.",
      "Another user locked or edited the round. Refresh and try again.",
    );
  }
}

/** Fault-injection hook used only by tests to force mid-transaction failure. */
export const transactionFault = {
  throwAfter: null as string | null,
  maybeThrow(label: string) {
    if (this.throwAfter === label) {
      throw new Error(`Injected transaction fault after ${label}`);
    }
  },
};
