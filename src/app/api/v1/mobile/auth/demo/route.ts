import { issueDemoSession, publicUser } from "@/lib/mobile-auth";
import { jsonError, jsonOk } from "@/lib/mobile-http";

export async function POST(req: Request) {
  let body: { userId?: number };
  try {
    body = (await req.json()) as { userId?: number };
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const userId = Number(body.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return jsonError("userId is required", 400);
  }

  const result = await issueDemoSession(userId);
  if ("error" in result) {
    return jsonError(result.error, result.status);
  }
  return jsonOk({
    token: result.token,
    user: publicUser(result.user),
  });
}
