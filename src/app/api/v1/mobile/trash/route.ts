import {
  getTrashItems,
  permanentlyDeleteTrashItem,
  restoreTrashItem,
} from "@/actions/recovery";
import { requireScopes } from "@/lib/api-auth";
import { DESTRUCTIVE_CHALLENGE_HEADER } from "@/lib/destructive-challenge";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "read:trash" }, async (principal) => {
    const data = await getTrashItems(principal.authorization);
    return jsonOk({ data: data ?? [] });
  });
}

export async function POST(req: Request) {
  return withMobileAuth(req, { scopes: "write:trash" }, async (principal) => {
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
        await restoreTrashItem(body.entityType, body.entityId, principal.authorization);
        return jsonOk({ ok: true, restored: true });
      }
      if (body.action === "permanent" && body.entityType && body.entityId) {
        const scope = requireScopes(principal.token, "write:destructive");
        if (!scope.ok) return jsonError(scope.error, scope.status);

        const challenge = req.headers.get(DESTRUCTIVE_CHALLENGE_HEADER)?.trim() ?? "";
        if (!challenge) {
          return jsonError(
            "X-Destructive-Challenge is required for permanent delete",
            400,
            { code: "BAD_REQUEST" },
          );
        }

        await permanentlyDeleteTrashItem(
          body.entityType,
          body.entityId,
          body.confirmation ?? "",
          principal.authorization,
          { token: principal.token, challenge },
          { requireApiChallenge: true },
        );
        return jsonOk({ ok: true, deleted: true });
      }
      return jsonError("Unknown action", 400);
    } catch (err) {
      return mapError(err);
    }
  });
}
