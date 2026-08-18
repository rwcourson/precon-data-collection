import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  estimateRounds,
  jobs,
  notifications,
  roundNoteAttachments,
  roundNoteMentions,
  roundNotes,
  users,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import {
  loadRoundForPrincipal,
  principalJobVisibilityPredicate,
} from "@/lib/authorization/loaders";
import { createPrincipal } from "@/lib/authorization/principal";
import type { Principal } from "@/lib/authorization/types";
import {
  extractMentionUserIds,
  firstLine,
  previewLatestNote,
} from "@/lib/note-body";
import {
  assertAllowedNoteAttachment,
  readNoteAttachmentBytes,
  storeNoteAttachment,
} from "@/lib/note-storage";
import { requireAuthorized } from "@/services/mutation-policy";

export type NoteAttachmentInput = {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
};

export type NoteThreadItem = {
  id: number;
  roundId: number;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  authorUserId: number;
  authorName: string;
  authorTitle: string | null;
  attachments: {
    id: number;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }[];
};

export type MentionPreview = {
  userId: number;
  name: string;
  region: string | null;
  canRead: boolean;
};

async function requireReadableRound(principal: Principal, roundId: number) {
  const loaded = await loadRoundForPrincipal(principal, roundId, {
    capability: "read",
  });
  if (!loaded) throw DomainError.notFound("Round not found");
  return loaded;
}

async function requireWritableRound(
  principal: Principal,
  roundId: number,
  capability: "notes.write" | "notes.attach"
) {
  const loaded = await requireReadableRound(principal, roundId);
  requireAuthorized(principal, capability, loaded.descriptor, "Round notes");
  return loaded;
}

function canModerateNotes(principal: Principal): boolean {
  return ["corporate_admin", "rpd", "admin_jsa"].includes(principal.user.role);
}

async function mentionedUserCanRead(
  user: typeof users.$inferSelect,
  roundId: number
) {
  const principal = createPrincipal({
    user,
    authSource: "demo_session",
    workspaceRegion: user.region,
  });
  return (
    (await loadRoundForPrincipal(principal, roundId, { capability: "read" })) !=
    null
  );
}

async function fanOutMentions(opts: {
  author: Principal;
  noteId: number;
  roundId: number;
  body: string;
  jobName: string;
  roundNumber: number;
}) {
  const ids = extractMentionUserIds(opts.body).filter(
    (id) => id !== opts.author.user.id
  );
  if (ids.length === 0) return;
  const existing = await db
    .select({ userId: roundNoteMentions.mentionedUserId })
    .from(roundNoteMentions)
    .where(eq(roundNoteMentions.noteId, opts.noteId));
  const already = new Set(existing.map((row) => row.userId));
  const roster = await db.select().from(users).where(inArray(users.id, ids));
  const excerpt = firstLine(opts.body, 140);
  const title = `${opts.author.user.name} mentioned you on ${opts.jobName} — R${opts.roundNumber}`;
  for (const target of roster) {
    const isNew = !already.has(target.id);
    if (isNew) {
      await db.insert(roundNoteMentions).values({
        noteId: opts.noteId,
        mentionedUserId: target.id,
      });
    }
    if (!isNew) continue;
    if (!(await mentionedUserCanRead(target, opts.roundId))) continue;
    await db.insert(notifications).values({
      userId: target.id,
      title,
      body: excerpt,
      roundId: opts.roundId,
      noteId: opts.noteId,
    });
  }
}

export const notesService = {
  async list(principal: Principal, roundId: number): Promise<NoteThreadItem[]> {
    await requireReadableRound(principal, roundId);
    const rows = await db
      .select({
        note: roundNotes,
        authorName: users.name,
        authorTitle: users.title,
      })
      .from(roundNotes)
      .innerJoin(users, eq(roundNotes.authorUserId, users.id))
      .where(and(eq(roundNotes.roundId, roundId), isNull(roundNotes.deletedAt)))
      .orderBy(roundNotes.createdAt);
    if (rows.length === 0) return [];
    const attachments = await db
      .select()
      .from(roundNoteAttachments)
      .where(
        inArray(
          roundNoteAttachments.noteId,
          rows.map((row) => row.note.id)
        )
      );
    const byNote = new Map<number, NoteThreadItem["attachments"]>();
    for (const file of attachments) {
      const list = byNote.get(file.noteId) ?? [];
      list.push({
        id: file.id,
        filename: file.filename,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
      });
      byNote.set(file.noteId, list);
    }
    return rows.map((row) => ({
      id: row.note.id,
      roundId: row.note.roundId,
      body: row.note.body,
      createdAt: row.note.createdAt,
      editedAt: row.note.editedAt,
      authorUserId: row.note.authorUserId,
      authorName: row.authorName,
      authorTitle: row.authorTitle,
      attachments: byNote.get(row.note.id) ?? [],
    }));
  },

  async countForRounds(principal: Principal, roundIds: number[]) {
    if (roundIds.length === 0) return new Map<number, number>();
    const rows = await db
      .select({
        roundId: roundNotes.roundId,
        n: count(),
      })
      .from(roundNotes)
      .innerJoin(estimateRounds, eq(roundNotes.roundId, estimateRounds.id))
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(
        and(
          inArray(roundNotes.roundId, roundIds),
          isNull(roundNotes.deletedAt),
          principalJobVisibilityPredicate(jobs.id, principal)
        )
      )
      .groupBy(roundNotes.roundId);
    return new Map(rows.map((row) => [row.roundId, Number(row.n)]));
  },

  async latestForRounds(principal: Principal, roundIds: number[]) {
    if (roundIds.length === 0) return new Map<number, string>();
    const notes = await db
      .select({
        roundId: roundNotes.roundId,
        body: roundNotes.body,
        createdAt: roundNotes.createdAt,
        authorName: users.name,
      })
      .from(roundNotes)
      .innerJoin(users, eq(roundNotes.authorUserId, users.id))
      .innerJoin(estimateRounds, eq(roundNotes.roundId, estimateRounds.id))
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(
        and(
          inArray(roundNotes.roundId, roundIds),
          isNull(roundNotes.deletedAt),
          principalJobVisibilityPredicate(jobs.id, principal)
        )
      )
      .orderBy(desc(roundNotes.createdAt));
    const out = new Map<number, string>();
    for (const note of notes) {
      if (out.has(note.roundId)) continue;
      out.set(
        note.roundId,
        previewLatestNote({
          authorName: note.authorName,
          createdAt: note.createdAt,
          body: note.body,
        })
      );
    }
    return out;
  },

  async create(
    principal: Principal,
    roundId: number,
    body: string,
    files: NoteAttachmentInput[] = []
  ): Promise<NoteThreadItem> {
    const loaded = await requireWritableRound(
      principal,
      roundId,
      "notes.write"
    );
    const trimmed = body.trim();
    if (!trimmed) throw DomainError.badRequest("Note body is required");
    if (trimmed.length > 10_000)
      throw DomainError.badRequest("Notes are limited to 10,000 characters");
    if (files.length > 0) {
      requireAuthorized(
        principal,
        "notes.attach",
        loaded.descriptor,
        "Round notes"
      );
      for (const file of files) {
        assertAllowedNoteAttachment(
          file.filename,
          file.contentType,
          file.bytes.byteLength
        );
      }
    }
    const [note] = await db
      .insert(roundNotes)
      .values({
        roundId,
        authorUserId: principal.user.id,
        body: trimmed,
      })
      .returning();
    if (!note) throw DomainError.badRequest("Could not save the note");
    for (const file of files) {
      const stored = await storeNoteAttachment({
        roundId,
        noteId: note.id,
        filename: file.filename,
        contentType: file.contentType,
        bytes: file.bytes,
      });
      await db.insert(roundNoteAttachments).values({
        noteId: note.id,
        storageKey: stored.storageKey,
        filename: file.filename,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        uploadedById: principal.user.id,
      });
    }
    await fanOutMentions({
      author: principal,
      noteId: note.id,
      roundId,
      body: trimmed,
      jobName: loaded.value.job.jobName,
      roundNumber: loaded.value.round.roundNumber,
    });
    const match = (await this.list(principal, roundId)).find(
      (row) => row.id === note.id
    );
    if (!match) throw DomainError.notFound("Note not found");
    return match;
  },

  async edit(
    principal: Principal,
    noteId: number,
    body: string
  ): Promise<NoteThreadItem> {
    const trimmed = body.trim();
    if (!trimmed) throw DomainError.badRequest("Note body is required");
    const [existing] = await db
      .select()
      .from(roundNotes)
      .where(eq(roundNotes.id, noteId))
      .limit(1);
    if (!existing || existing.deletedAt)
      throw DomainError.notFound("Note not found");
    const loaded = await requireWritableRound(
      principal,
      existing.roundId,
      "notes.write"
    );
    if (existing.authorUserId !== principal.user.id) {
      throw DomainError.forbidden("Only the author can edit this note");
    }
    await db
      .update(roundNotes)
      .set({ body: trimmed, editedAt: new Date() })
      .where(eq(roundNotes.id, noteId));
    await fanOutMentions({
      author: principal,
      noteId,
      roundId: existing.roundId,
      body: trimmed,
      jobName: loaded.value.job.jobName,
      roundNumber: loaded.value.round.roundNumber,
    });
    const match = (await this.list(principal, existing.roundId)).find(
      (row) => row.id === noteId
    );
    if (!match) throw DomainError.notFound("Note not found");
    return match;
  },

  async softDelete(principal: Principal, noteId: number): Promise<number> {
    const [existing] = await db
      .select()
      .from(roundNotes)
      .where(eq(roundNotes.id, noteId))
      .limit(1);
    if (!existing || existing.deletedAt)
      throw DomainError.notFound("Note not found");
    await requireWritableRound(principal, existing.roundId, "notes.write");
    if (
      existing.authorUserId !== principal.user.id &&
      !canModerateNotes(principal)
    ) {
      throw DomainError.forbidden("Only the author can delete this note");
    }
    await db
      .update(roundNotes)
      .set({
        deletedAt: new Date(),
        deletedById: principal.user.id,
      })
      .where(eq(roundNotes.id, noteId));
    await db.insert(auditLog).values({
      entity: "round_note",
      entityId: noteId,
      roundId: existing.roundId,
      action: "soft-delete",
      userId: principal.user.id,
    });
    return existing.roundId;
  },

  async downloadAttachment(principal: Principal, attachmentId: number) {
    const [file] = await db
      .select({
        attachment: roundNoteAttachments,
        note: roundNotes,
      })
      .from(roundNoteAttachments)
      .innerJoin(roundNotes, eq(roundNoteAttachments.noteId, roundNotes.id))
      .where(eq(roundNoteAttachments.id, attachmentId))
      .limit(1);
    if (!file || file.note.deletedAt)
      throw DomainError.notFound("Attachment not found");
    await requireReadableRound(principal, file.note.roundId);
    const bytes = await readNoteAttachmentBytes(file.attachment.storageKey);
    if (!bytes) throw DomainError.notFound("Attachment not found");
    return {
      filename: file.attachment.filename,
      contentType: file.attachment.contentType,
      bytes,
    };
  },

  async previewMentions(
    principal: Principal,
    roundId: number,
    userIds: number[]
  ) {
    const loaded = await requireReadableRound(principal, roundId);
    const unique = [
      ...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)),
    ];
    if (unique.length === 0)
      return { jobId: loaded.value.job.id, mentions: [] as MentionPreview[] };
    const roster = await db
      .select()
      .from(users)
      .where(inArray(users.id, unique));
    const mentions: MentionPreview[] = [];
    for (const target of roster) {
      mentions.push({
        userId: target.id,
        name: target.name,
        region: target.region,
        canRead: await mentionedUserCanRead(target, roundId),
      });
    }
    return { jobId: loaded.value.job.id, mentions };
  },
};

/** Phase 8 reports — latest note on a pricing effort, never a job. */
export async function getLatestNotesForRounds(
  principal: Principal,
  roundIds: number[]
) {
  return notesService.latestForRounds(principal, roundIds);
}
