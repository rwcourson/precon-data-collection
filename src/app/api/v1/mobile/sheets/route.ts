import { createSheet } from "@/actions/sheets";
import { listArchivedSheets, listSheets } from "@/lib/sheets-server";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import { getCurrentUser } from "@/lib/current-user";
import { getWorkspace } from "@/lib/workspace-server";

export async function GET(req: Request) {
  return withMobileAuth(req, async () => {
    const url = new URL(req.url);
    const archived = url.searchParams.get("archived") === "1";
    const user = await getCurrentUser();
    const workspace = await getWorkspace();
    if (archived) {
      const data = await listArchivedSheets(workspace, user);
      return jsonOk({ data });
    }
    const data = await listSheets(workspace, user);
    return jsonOk({ data });
  });
}

export async function POST(req: Request) {
  return withMobileAuth(req, async () => {
    let body: Parameters<typeof createSheet>[0];
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      const id = await createSheet(body);
      return jsonOk({ id }, { status: 201 });
    } catch (err) {
      return mapError(err);
    }
  });
}
