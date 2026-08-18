import type { NextRequest } from "next/server";
import { DomainError } from "@/domain/errors";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { attachmentContentDisposition } from "@/lib/note-storage";
import { notesService } from "@/services/notes-service";

export const dynamic = "force-dynamic";

// The stored content type is attacker-supplied at upload time; only echo it
// back for well-known safe types and fall back to a generic binary download.
const SAFE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function safeContentType(stored: string): string {
  const normalized = stored.split(";")[0]?.trim().toLowerCase() ?? "";
  return SAFE_CONTENT_TYPES.has(normalized)
    ? normalized
    : "application/octet-stream";
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const attachmentId = Number(id);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return new Response("Not found", { status: 404 });
    }
    const principal = await getWebPrincipal();
    const file = await notesService.downloadAttachment(principal, attachmentId);
    return new Response(Buffer.from(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": safeContentType(file.contentType),
        "Content-Disposition": attachmentContentDisposition(file.filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "FORBIDDEN"
            ? 403
            : 400;
      return new Response(error.what, { status });
    }
    return new Response("Not found", { status: 404 });
  }
}
