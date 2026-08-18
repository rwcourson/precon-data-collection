import "server-only";

import { revalidatePath } from "next/cache";
import { createRoundNoteSchema } from "@/domain/contracts";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { notesService } from "@/services/notes-service";

function isUploadedFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "name" in value &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    "size" in value &&
    typeof value.size === "number" &&
    value.size > 0
  );
}

export function revalidateRoundNotes(roundId: number) {
  revalidatePath("/bid-schedule");
  revalidatePath(`/rounds/${roundId}`);
  revalidatePath("/", "layout");
}

export async function createNoteFromUploadedForm(formData: FormData) {
  const roundId = Number(formData.get("roundId"));
  const body = String(formData.get("body") ?? "");
  const files: { filename: string; contentType: string; bytes: Uint8Array }[] = [];
  for (const value of formData.getAll("files")) {
    if (!isUploadedFile(value)) continue;
    files.push({
      filename: value.name,
      contentType: value.type || "application/octet-stream",
      bytes: new Uint8Array(await value.arrayBuffer()),
    });
  }
  const parsed = createRoundNoteSchema.parse({ roundId, body });
  const principal = await getWebPrincipal();
  const note = await notesService.create(principal, parsed.roundId, parsed.body, files);
  revalidateRoundNotes(parsed.roundId);
  return note;
}
