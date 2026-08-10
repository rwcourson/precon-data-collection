import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import { pursuitService } from "@/services/pursuit-service";
import type { RoundStatus } from "@/db/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, { scopes: "write:pursuits" }, async (principal) => {
    const { id } = await ctx.params;
    const roundId = Number(id);
    if (!Number.isFinite(roundId)) return jsonError("Invalid round id", 400);
    let body: { to?: string };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    if (!body.to) return jsonError("to status is required", 400);
    try {
      await pursuitService.transitionStatus(
        principal.authorization,
        roundId,
        body.to as RoundStatus,
      );
      return jsonOk({ ok: true, status: body.to });
    } catch (err) {
      return mapError(err);
    }
  });
}
