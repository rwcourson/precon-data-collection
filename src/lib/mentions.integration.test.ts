import { afterAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { NoteBody } from "@/components/notes/note-body";
import { db } from "@/db";
import { estimateRounds, jobs, notifications, roundNoteMentions, roundNotes, users } from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import { formatMentionToken } from "@/lib/note-body";
import { notesService } from "@/services/notes-service";
import type { User } from "@/db/schema";

function principalFor(user: User, workspaceRegion: string | null) {
  return createPrincipal({ user, authSource: "sso", workspaceRegion });
}

describe("note mentions", () => {
  const createdNoteIds: number[] = [];
  const createdUserIds: number[] = [];
  const originalNameById = new Map<number, string>();

  afterAll(async () => {
    if (createdNoteIds.length > 0) {
      await db.delete(notifications).where(inArray(notifications.noteId, createdNoteIds));
      await db.delete(roundNoteMentions).where(inArray(roundNoteMentions.noteId, createdNoteIds));
      await db.delete(roundNotes).where(inArray(roundNotes.id, createdNoteIds));
    }
    for (const [id, name] of originalNameById) {
      await db.update(users).set({ name }).where(eq(users.id, id));
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("fans out one notification, suppresses inaccessible users, and does not notify on edit without new mentions", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [lead] = await db.select().from(users).where(eq(users.role, "estimate_lead")).limit(1);
    const [round] = await db
      .select({ id: estimateRounds.id, jobName: jobs.jobName, roundNumber: estimateRounds.roundNumber })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(and(eq(jobs.region, "Central"), isNull(estimateRounds.deletedAt)))
      .limit(1);
    const [outsider] = await db
      .insert(users)
      .values({
        name: "Florida Mention PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Florida",
        preconDepartment: "Florida",
        email: `fl-mention-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(outsider.id);

    const actor = principalFor(pcm, "Central");
    const preview = await notesService.previewMentions(actor, round.id, [lead.id, outsider.id]);
    expect(preview.mentions.find((row) => row.userId === lead.id)?.canRead).toBe(true);
    expect(preview.mentions.find((row) => row.userId === outsider.id)?.canRead).toBe(false);

    const created = await notesService.create(
      actor,
      round.id,
      `${formatMentionToken(lead.id)} staffing? ${formatMentionToken(outsider.id)} also`,
    );
    createdNoteIds.push(created.id);

    const leadNotes = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, lead.id), eq(notifications.noteId, created.id)));
    expect(leadNotes).toHaveLength(1);
    expect(leadNotes[0].title).toContain(pcm.name);
    expect(leadNotes[0].title).toContain(`R${round.roundNumber}`);
    expect(leadNotes[0].roundId).toBe(round.id);

    const outsiderNotes = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, outsider.id), eq(notifications.noteId, created.id)));
    expect(outsiderNotes).toHaveLength(0);

    await notesService.edit(actor, created.id, `${created.body} (still waiting)`);
    const afterEdit = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, lead.id), eq(notifications.noteId, created.id)));
    expect(afterEdit).toHaveLength(1);
  });

  it("renders the mentioned user's current name from the token id, not a stored display string", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [lead] = await db.select().from(users).where(eq(users.role, "estimate_lead")).limit(1);
    originalNameById.set(lead.id, lead.name);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(and(eq(jobs.region, "Central"), isNull(estimateRounds.deletedAt)))
      .limit(1);
    const actor = principalFor(pcm, "Central");
    const created = await notesService.create(
      actor,
      round.id,
      `${formatMentionToken(lead.id)} do you have an assistant precon manager?`,
    );
    createdNoteIds.push(created.id);
    await db.update(users).set({ name: "William Stocks" }).where(eq(users.id, lead.id));
    const html = renderToStaticMarkup(
      createElement(NoteBody, {
        body: created.body,
        names: { [lead.id]: "William Stocks" },
      }),
    );
    expect(html).toContain("William Stocks");
    expect(html).not.toContain(lead.name);
    expect(created.body).toContain(`@[${lead.id}]`);
    expect(created.body).not.toContain("William Stocks");
  });
});
