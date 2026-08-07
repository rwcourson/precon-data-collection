"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, estimateRounds, jobs } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { mapDestiniSheet } from "@/lib/destini-import";
import { appendEntityVersion } from "@/lib/recovery";
import { assertCanWriteField } from "@/lib/policy";

export async function importDestiniRows(input: {
  headers: string[];
  rows: unknown[][];
}) {
  const user = await getCurrentUser();
  if (!["admin_jsa", "rpd", "estimate_lead", "corporate_admin"].includes(user.role)) {
    throw new Error("Permission denied.");
  }
  const mapped = mapDestiniSheet(input.headers, input.rows);
  let updated = 0;
  let unmatched = 0;

  for (const row of mapped) {
    if (!row.jobNumber) {
      unmatched++;
      continue;
    }
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.jobNumber, row.jobNumber), isNull(jobs.deletedAt)));
    if (!job) {
      unmatched++;
      continue;
    }
    const rounds = await db
      .select()
      .from(estimateRounds)
      .where(and(eq(estimateRounds.jobId, job.id), isNull(estimateRounds.deletedAt)));
    const round =
      (row.estimatePhase
        ? rounds.find((r) => r.estimatePhase === row.estimatePhase)
        : null) ?? rounds.sort((a, b) => b.roundNumber - a.roundNumber)[0];
    if (!round) {
      unmatched++;
      continue;
    }

    for (const key of Object.keys(row.values)) {
      assertCanWriteField(user, key, round);
    }

    await appendEntityVersion("round", round.id, { ...round }, user.id);
    await db
      .update(estimateRounds)
      .set({
        ...(row.values as Record<string, number | string | null>),
        updatedAt: new Date(),
      })
      .where(eq(estimateRounds.id, round.id));
    await db.insert(auditLog).values({
      entity: "round",
      entityId: round.id,
      roundId: round.id,
      action: "destini_import",
      userId: user.id,
      newValue: JSON.stringify(Object.keys(row.values)),
    });
    updated++;
  }

  revalidatePath("/post-bid");
  revalidatePath("/admin");
  return { updated, unmatched, total: mapped.length };
}
