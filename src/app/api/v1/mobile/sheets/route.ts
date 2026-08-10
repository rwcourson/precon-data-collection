import { createSheet } from "@/actions/sheets";
import { listArchivedSheets, listSheets } from "@/lib/sheets-server";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "read:sheets" }, async (principal) => {
    const url = new URL(req.url);
    const archived = url.searchParams.get("archived") === "1";
    if (archived) {
      const data = await listArchivedSheets(principal.authorization);
      return jsonOk({ data });
    }
    const data = await listSheets(principal.authorization);
    return jsonOk({ data });
  });
}

export async function POST(req: Request) {
  return withMobileAuth(req, { scopes: "write:sheets" }, async () => {
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
