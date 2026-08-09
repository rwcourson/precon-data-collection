import { getAllUsers } from "@/lib/current-user";
import { isDemoAuthAllowed, publicUser } from "@/lib/mobile-auth";
import { jsonError, jsonOk } from "@/lib/mobile-http";

/** Demo persona list — only when AUTH_MODE=demo. */
export async function GET() {
  if (!isDemoAuthAllowed()) {
    return jsonError("Demo personas are disabled", 403);
  }
  const users = await getAllUsers();
  return jsonOk({ data: users.map(publicUser) });
}
