import { NextRequest } from "next/server";
import { DomainError } from "@/domain/errors";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { attachmentContentDisposition } from "@/lib/note-storage";
import { notesService } from "@/services/notes-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
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
        "Content-Type": file.contentType,
        "Content-Disposition": attachmentContentDisposition(file.filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
      return new Response(error.what, { status });
    }
    return new Response("Not found", { status: 404 });
  }
}
