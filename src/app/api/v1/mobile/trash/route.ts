import {
  getTrashItems,
  permanentlyDeleteTrashItem,
  restoreTrashItem,
} from "@/actions/recovery";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function GET(req: Request) {
  return withMobileAuth(req, async () => {
    const region = new URL(req.url).searchParams.get("region");
    const data = await getTrashItems(region);
    return jsonOk({ data: data ?? [] });
  });
}

export async function POST(req: Request) {
  return withMobileAuth(req, async () => {
    let body: {
      action?: string;
      entityType?: "job" | "round" | "sheet" | "sheet_row";
      entityId?: number;
      confirmation?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      if (body.action === "restore" && body.entityType && body.entityId) {
        await restoreTrashItem(body.entityType, body.entityId);
        return jsonOk({ ok: true, restored: true });
      }
      if (body.action === "permanent" && body.entityType && body.entityId) {
        await permanentlyDeleteTrashItem(
          body.entityType,
          body.entityId,
          body.confirmation ?? "",
        );
        return jsonOk({ ok: true, deleted: true });
      }
      return jsonError("Unknown action", 400);
    } catch (err) {
      return mapError(err);
    }
  });
}
