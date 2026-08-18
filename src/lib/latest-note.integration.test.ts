import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { estimateRounds, jobs, roundNotes, users } from "@/db/schema";
import { formatLatestNoteCell, LATEST_NOTE_KEY } from "@/lib/latest-note";
import { loadLatestNotesForRounds } from "@/lib/latest-note-query";
import { buildFieldCatalog, formatReportValue, runReportEngine } from "@/lib/report-engine";

describe("latest-note DISTINCT ON query", () => {
  const createdNoteIds: number[] = [];

  afterAll(async () => {
    if (createdNoteIds.length > 0) {
      await db.delete(roundNotes).where(inArray(roundNotes.id, createdNoteIds));
    }
  });

  async function unusedRounds(limit: number) {
    return db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .leftJoin(roundNotes, eq(roundNotes.roundId, estimateRounds.id))
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(and(eq(jobs.region, "Central"), isNull(estimateRounds.deletedAt), isNull(roundNotes.id)))
      .limit(limit);
  }

  it("returns only the most recent non-deleted note per round", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [round] = await unusedRounds(1);
    if (!round) throw new Error("expected an unused Central round");

    const oldest = await db
      .insert(roundNotes)
      .values({
        roundId: round.id,
        authorUserId: pcm.id,
        body: "oldest thread note",
        createdAt: new Date(Date.now() - 120_000),
      })
      .returning();
    const middle = await db
      .insert(roundNotes)
      .values({
        roundId: round.id,
        authorUserId: pcm.id,
        body: "middle thread note",
        createdAt: new Date(Date.now() - 60_000),
      })
      .returning();
    const newest = await db
      .insert(roundNotes)
      .values({
        roundId: round.id,
        authorUserId: pcm.id,
        body: "newest thread note",
        createdAt: new Date(),
      })
      .returning();
    createdNoteIds.push(oldest[0]!.id, middle[0]!.id, newest[0]!.id);

    const map = await loadLatestNotesForRounds([round.id]);
    expect(map.size).toBe(1);
    expect(map.get(round.id)?.body).toBe("newest thread note");
    expect(map.get(round.id)?.body).not.toContain("oldest");
    expect(map.get(round.id)?.body).not.toContain("middle");

    const cell = formatLatestNoteCell(map.get(round.id)!);
    const result = runReportEngine(
      [{ id: round.id, jobName: "Fixture", [LATEST_NOTE_KEY]: cell }],
      {
        fields: ["jobName", LATEST_NOTE_KEY],
        filters: [],
        groupBy: [],
        aggregations: [],
        sortBy: [],
      },
      buildFieldCatalog([]),
    );
    expect(String(result.rows[0]![LATEST_NOTE_KEY])).toContain("newest thread note");
    expect(String(result.rows[0]![LATEST_NOTE_KEY])).not.toContain("oldest thread note");
  });

  it("excludes soft-deleted notes and returns empty for rounds with none", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [withDeleted, empty] = await unusedRounds(2);
    if (!withDeleted || !empty) throw new Error("expected two unused Central rounds");
    expect(empty.id).not.toBe(withDeleted.id);

    const [deleted] = await db
      .insert(roundNotes)
      .values({
        roundId: withDeleted.id,
        authorUserId: pcm.id,
        body: "should not appear",
        createdAt: new Date(),
        deletedAt: new Date(),
        deletedById: pcm.id,
      })
      .returning();
    createdNoteIds.push(deleted.id);

    const map = await loadLatestNotesForRounds([withDeleted.id, empty.id]);
    expect(map.has(withDeleted.id)).toBe(false);
    expect(map.has(empty.id)).toBe(false);
    expect(formatReportValue(LATEST_NOTE_KEY, null, buildFieldCatalog([]))).toBe("");
  });
});
