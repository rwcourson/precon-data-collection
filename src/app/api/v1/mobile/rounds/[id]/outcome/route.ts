import { setOutcome } from "@/actions/post-bid";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
    const { id } = await ctx.params;
    const roundId = Number(id);
    if (!Number.isFinite(roundId)) return jsonError("Invalid round id", 400);
    let body: { outcome?: string };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    if (!body.outcome) return jsonError("outcome is required", 400);
    try {
      await setOutcome(roundId, body.outcome as Parameters<typeof setOutcome>[1]);
      return jsonOk({ ok: true, outcome: body.outcome });
    } catch (err) {
      return mapError(err);
    }
  });
}
