import { NextRequest } from "next/server";
import { createNoteFromUploadedForm } from "@/lib/note-create";
import { mapError } from "@/lib/mobile-http";

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
