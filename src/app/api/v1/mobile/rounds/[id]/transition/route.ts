import { transitionStatus } from "@/actions/pursuits";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
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
      await transitionStatus(roundId, body.to as Parameters<typeof transitionStatus>[1]);
      return jsonOk({ ok: true, status: body.to });
    } catch (err) {
      return mapError(err);
    }
  });
}
