import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { roundNotes, users } from "@/db/schema";
import {
  formatLatestNoteCell,
  type LatestNoteSource,
} from "@/lib/latest-note";

/**
 * One DISTINCT ON query per export: latest non-deleted note per round.
 * Relies on `round_notes_round_created_idx` (roundId, createdAt).
 */
export async function loadLatestNotesForRounds(
  roundIds: number[],
): Promise<Map<number, LatestNoteSource>> {
  if (roundIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([roundNotes.roundId], {
      roundId: roundNotes.roundId,
      body: roundNotes.body,
      createdAt: roundNotes.createdAt,
      authorName: users.name,
    })
    .from(roundNotes)
    .innerJoin(users, eq(roundNotes.authorUserId, users.id))
    .where(and(inArray(roundNotes.roundId, roundIds), isNull(roundNotes.deletedAt)))
    .orderBy(roundNotes.roundId, desc(roundNotes.createdAt));

  return new Map(
    rows.map((row) => [
      row.roundId,
      { authorName: row.authorName, createdAt: row.createdAt, body: row.body },
    ]),
  );
}

export async function latestNoteCellsForRounds(
  roundIds: number[],
): Promise<Map<number, string>> {
  const notes = await loadLatestNotesForRounds(roundIds);
  const out = new Map<number, string>();
  for (const [roundId, note] of notes) {
    out.set(roundId, formatLatestNoteCell(note));
  }
  return out;
}
