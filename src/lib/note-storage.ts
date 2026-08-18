import { randomUUID } from "node:crypto";
import { DomainError } from "@/domain/errors";
import { getArtifactStorage } from "@/lib/artifact-storage";

export const NOTE_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export function assertAllowedNoteAttachment(filename: string, _contentType: string, sizeBytes: number): void {
  if (!filename.trim()) {
    throw DomainError.badRequest("Attachment is missing a file name");
  }
  if (sizeBytes > NOTE_ATTACHMENT_MAX_BYTES) {
    throw DomainError.badRequest("Attachments must be 25 MB or smaller");
  }
}

export async function storeNoteAttachment(opts: {
  roundId: number;
  noteId: number;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<{ storageKey: string; sizeBytes: number; contentType: string }> {
  assertAllowedNoteAttachment(opts.filename, opts.contentType, opts.bytes.byteLength);
  const safeName = opts.filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const key = `notes/${opts.roundId}/${opts.noteId}/${randomUUID()}-${safeName}`;
  const stored = await getArtifactStorage().put(key, opts.bytes, opts.contentType);
  return {
    storageKey: stored.storageKey,
    sizeBytes: stored.byteSize,
    contentType: opts.contentType,
  };
}

export async function readNoteAttachmentBytes(storageKey: string): Promise<Uint8Array | null> {
  return getArtifactStorage().get(storageKey);
}

export function attachmentContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii || "download"}"`;
}
