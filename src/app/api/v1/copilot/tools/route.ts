import { isCopilotToolName, verifyCopilotToolRequest } from "@/lib/ai/copilot-bridge";
import { mapError } from "@/lib/mobile-http";
import { copilotQueryService } from "@/services/copilot-query-service";

export const runtime = "nodejs";

type Body = {
  tool?: string;
  input?: Record<string, unknown>;
};

export async function POST(req: Request) {
  // The signature covers the raw body, so read the exact wire bytes once and
  // parse only after the hash is pinned down.
  const rawBody = await req.text();
  let body: Body;
  try {
    body = JSON.parse(rawBody) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tool = body.tool ?? "";
  const principalId = req.headers.get("x-eve-principal-id") ?? "";
  const hmac = req.headers.get("x-eve-hmac");
  const timestamp = Number(req.headers.get("x-eve-ts"));
  const userId = Number(principalId);
  if (
    !isCopilotToolName(tool) ||
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !verifyCopilotToolRequest({ principalId, tool, timestamp, rawBody, hmac })
  ) {
    return Response.json({ error: "Unauthorized tool call" }, { status: 401 });
  }
  const workspaceHeader = req.headers.get("x-eve-workspace");
  const workspaceRegion = workspaceHeader === "" ? null : workspaceHeader;
  try {
    const principal = await copilotQueryService.principalForUserId(userId, workspaceRegion);
    const result = await copilotQueryService.execute(principal, tool, body.input ?? {});
    return Response.json(result);
  } catch (error) {
    return mapError(error);
  }
}
