"use server";

import { revalidatePath } from "next/cache";
import {
  createRoundNoteSchema,
  editRoundNoteSchema,
  roundNoteIdSchema,
} from "@/domain/contracts";
import { DomainError, findDomainError } from "@/domain/errors";
import { principalCanAssignJobUser } from "@/lib/authorization/decisions";
import {
  listDirectoryUsersForPrincipal,
  loadRoundForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { extractMentionUserIds } from "@/lib/note-body";
import {
  createNoteFromUploadedForm,
  revalidateRoundNotes,
} from "@/lib/note-create";
import { notesService } from "@/services/notes-service";

export type NotesDirectoryUser = {
  id: number;
  name: string;
  title: string | null;
  region: string | null;
};

export async function getRoundNotes(roundId: number) {
  const principal = await getWebPrincipal();
  const [notes, directory, loaded] = await Promise.all([
    notesService.list(principal, roundId),
    listDirectoryUsersForPrincipal(principal),
    loadRoundForPrincipal(principal, roundId),
  ]);
  return {
    notes,
    directory: directory.map((user) => ({
      id: user.id,
      name: user.name,
      title: user.title,
      region: user.region,
    })),
    jobId: loaded?.value.job.id ?? 0,
    canAssignUsers: principalCanAssignJobUser(principal),
  };
}

export async function previewRoundNoteMentions(roundId: number, body: string) {
  const principal = await getWebPrincipal();
  return notesService.previewMentions(
    principal,
    roundId,
    extractMentionUserIds(body)
  );
}

export async function createRoundNote(input: {
  roundId: number;
  body: string;
  files?: { filename: string; contentType: string; bytes: number[] }[];
}) {
  const parsed = createRoundNoteSchema.parse({
    roundId: input.roundId,
    body: input.body,
  });
  const principal = await getWebPrincipal();
  const files = (input.files ?? []).map((file) => ({
    filename: file.filename,
    contentType: file.contentType,
    bytes: Uint8Array.from(file.bytes),
  }));
  const note = await notesService.create(
    principal,
    parsed.roundId,
    parsed.body,
    files
  );
  revalidateRoundNotes(parsed.roundId);
  return note;
}

function noteActionError(error: unknown, fallback: string) {
  const domain = findDomainError(error);
  if (domain) return domain.what;
  if (error instanceof DomainError) return error.what;
  if (
    error instanceof Error &&
    error.message &&
    !/Minified React error #\d+/.test(error.message)
  ) {
    return error.message;
  }
  return fallback;
}

export async function createRoundNoteFromForm(formData: FormData) {
  try {
    return {
      ok: true as const,
      note: await createNoteFromUploadedForm(formData),
    };
  } catch (error) {
    return {
      ok: false as const,
      error: noteActionError(error, "Could not post the note"),
    };
  }
}

export async function editRoundNote(input: { noteId: number; body: string }) {
  const parsed = editRoundNoteSchema.parse(input);
  const principal = await getWebPrincipal();
  const note = await notesService.edit(principal, parsed.noteId, parsed.body);
  revalidateRoundNotes(note.roundId);
  return note;
}

export async function deleteRoundNote(input: { noteId: number }) {
  const parsed = roundNoteIdSchema.parse(input);
  const principal = await getWebPrincipal();
  const roundId = await notesService.softDelete(principal, parsed.noteId);
  revalidatePath("/bid-schedule");
  revalidatePath(`/rounds/${roundId}`);
  revalidatePath("/", "layout");
}
