"use server";

import { revalidatePath } from "next/cache";
import {
  createRoundNoteSchema,
  editRoundNoteSchema,
  roundNoteIdSchema,
} from "@/domain/contracts";
import { principalCanAssignJobUser } from "@/lib/authorization/decisions";
import { listDirectoryUsersForPrincipal, loadRoundForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { extractMentionUserIds } from "@/lib/note-body";
import { notesService } from "@/services/notes-service";

function revalidateRound(roundId: number) {
  revalidatePath("/bid-schedule");
  revalidatePath(`/rounds/${roundId}`);
  revalidatePath("/", "layout");
}

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
  return notesService.previewMentions(principal, roundId, extractMentionUserIds(body));
}

export async function createRoundNote(input: {
  roundId: number;
  body: string;
  files?: { filename: string; contentType: string; bytes: number[] }[];
}) {
  const parsed = createRoundNoteSchema.parse({ roundId: input.roundId, body: input.body });
  const principal = await getWebPrincipal();
  const files = (input.files ?? []).map((file) => ({
    filename: file.filename,
    contentType: file.contentType,
    bytes: Uint8Array.from(file.bytes),
  }));
  const note = await notesService.create(principal, parsed.roundId, parsed.body, files);
  revalidateRound(parsed.roundId);
  return note;
}

export async function createRoundNoteFromForm(formData: FormData) {
  const roundId = Number(formData.get("roundId"));
  const body = String(formData.get("body") ?? "");
  const files: { filename: string; contentType: string; bytes: Uint8Array }[] = [];
  for (const value of formData.getAll("files")) {
    if (!(value instanceof File) || value.size === 0) continue;
    files.push({
      filename: value.name,
      contentType: value.type || "application/octet-stream",
      bytes: new Uint8Array(await value.arrayBuffer()),
    });
  }
  const parsed = createRoundNoteSchema.parse({ roundId, body });
  const principal = await getWebPrincipal();
  const note = await notesService.create(principal, parsed.roundId, parsed.body, files);
  revalidateRound(parsed.roundId);
  return note;
}

export async function editRoundNote(input: { noteId: number; body: string }) {
  const parsed = editRoundNoteSchema.parse(input);
  const principal = await getWebPrincipal();
  const note = await notesService.edit(principal, parsed.noteId, parsed.body);
  revalidateRound(note.roundId);
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
