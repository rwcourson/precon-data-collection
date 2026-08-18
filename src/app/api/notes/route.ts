import type { NextRequest } from "next/server";
import { mapError } from "@/lib/mobile-http";
import { createNoteFromUploadedForm } from "@/lib/note-create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const note = await createNoteFromUploadedForm(formData);
    return Response.json(note);
  } catch (error) {
    return mapError(error);
  }
}
