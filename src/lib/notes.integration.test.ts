import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { GET as downloadAttachment } from "@/app/api/notes/attachments/[id]/route";
import { db } from "@/db";
import { auditLog, estimateRounds, jobs, roundNoteAttachments, roundNotes, users } from "@/db/schema";
import type { User } from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import { DEMO_USER_COOKIE } from "@/lib/current-user";
import { NOTE_ATTACHMENT_MAX_BYTES } from "@/lib/note-storage";
import { WORKSPACE_COOKIE } from "@/lib/workspace";
import { notesService } from "@/services/notes-service";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function principalFor(user: User, workspaceRegion: string | null) {
  return createPrincipal({ user, authSource: "sso", workspaceRegion });
}

describe("effort notes", () => {
  const createdNoteIds: number[] = [];
  const createdUserIds: number[] = [];

  afterAll(async () => {
    if (createdNoteIds.length > 0) {
      await db.delete(roundNoteAttachments).where(inArray(roundNoteAttachments.noteId, createdNoteIds));
      await db.delete(auditLog).where(
        and(eq(auditLog.entity, "round_note"), inArray(auditLog.entityId, createdNoteIds)),
      );
      await db.delete(roundNotes).where(inArray(roundNotes.id, createdNoteIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("creates, edits, and soft-deletes with author timestamps and edited marker", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
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
      "Updated drawing due date after talking to this DM.",
    );
    createdNoteIds.push(created.id);
    expect(created.authorUserId).toBe(pcm.id);
    expect(created.authorName).toBe(pcm.name);
    expect(created.editedAt).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);

    const edited = await notesService.edit(actor, created.id, "Updated drawing due date — confirmed.");
    expect(edited.editedAt).toBeInstanceOf(Date);
    expect(edited.body).toContain("confirmed");

    await notesService.softDelete(actor, created.id);
    const listed = await notesService.list(actor, round.id);
    expect(listed.some((note) => note.id === created.id)).toBe(false);
    const [audit] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, "round_note"), eq(auditLog.entityId, created.id)));
    expect(audit?.action).toBe("soft-delete");
  });

  it("denies list and create when the principal cannot read the round", async () => {
    const [centralRound] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(and(eq(jobs.region, "Central"), isNull(estimateRounds.deletedAt)))
      .limit(1);
    const [outsider] = await db
      .insert(users)
      .values({
        name: "Florida Notes PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Florida",
        preconDepartment: "Florida",
        email: `fl-notes-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(outsider.id);
    const actor = principalFor(outsider, "Florida");
    await expect(notesService.list(actor, centralRound.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(notesService.create(actor, centralRound.id, "should not land")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects oversized attachments, accepts any type, and downloads with attachment disposition", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(and(eq(jobs.region, "Central"), isNull(estimateRounds.deletedAt)))
      .limit(1);
    const actor = principalFor(pcm, "Central");

    const oversized = new Uint8Array(1);
    Object.defineProperty(oversized, "byteLength", { value: NOTE_ATTACHMENT_MAX_BYTES + 1 });
    await expect(
      notesService.create(actor, round.id, "too big", [
        {
          filename: "huge.pdf",
          contentType: "application/pdf",
          bytes: oversized,
        },
      ]),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const binary = await notesService.create(actor, round.id, "any type is fine", [
      { filename: "payload.exe", contentType: "application/x-msdownload", bytes: new Uint8Array([1, 2, 3]) },
    ]);
    createdNoteIds.push(binary.id);
    expect(binary.attachments[0]?.filename).toBe("payload.exe");

    const created = await notesService.create(actor, round.id, "see attached plan", [
      { filename: "plan.png", contentType: "image/png", bytes: PNG },
    ]);
    createdNoteIds.push(created.id);
    const attachment = created.attachments[0];
    expect(attachment?.filename).toBe("plan.png");

    const store = await cookies();
    store.set(DEMO_USER_COOKIE, String(pcm.id));
    store.set(WORKSPACE_COOKIE, pcm.region ?? "Central");
    const response = await downloadAttachment(
      new NextRequest(`http://localhost/api/notes/attachments/${attachment.id}`),
      { params: Promise.resolve({ id: String(attachment.id) }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/attachment; filename="plan.png"/);
    expect(response.headers.get("content-type")).toBe("image/png");
    const body = new Uint8Array(await response.arrayBuffer());
    expect(body.byteLength).toBe(PNG.byteLength);
  });

  it("accepts a 10,000-character note and rejects 10,001", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(and(eq(jobs.region, "Central"), isNull(estimateRounds.deletedAt)))
      .limit(1);
    const actor = principalFor(pcm, "Central");
    const created = await notesService.create(actor, round.id, "x".repeat(10_000));
    createdNoteIds.push(created.id);
    expect(created.body).toHaveLength(10_000);
    await expect(notesService.create(actor, round.id, "x".repeat(10_001))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("lists a 50-note thread without dropping rows", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(and(eq(jobs.region, "Central"), isNull(estimateRounds.deletedAt)))
      .limit(1);
    const inserted = await db
      .insert(roundNotes)
      .values(
        Array.from({ length: 50 }, (_, index) => ({
          roundId: round.id,
          authorUserId: pcm.id,
          body: `Thread note ${index + 1}`,
        })),
      )
      .returning({ id: roundNotes.id });
    createdNoteIds.push(...inserted.map((row) => row.id));
    const listed = await notesService.list(principalFor(pcm, "Central"), round.id);
    const ids = new Set(listed.map((note) => note.id));
    expect(inserted.every((row) => ids.has(row.id))).toBe(true);
  });
});
