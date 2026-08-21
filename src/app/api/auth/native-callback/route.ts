import { isCursorRedirect } from "@/lib/mcp/dcr-native";

const OAUTH_RESPONSE_PARAMS = [
  "code",
  "state",
  "iss",
  "error",
  "error_description",
  "error_uri",
] as const;

/**
 * Cursor's native OAuth callback has a naming authority (`cursor://host/...`),
 * which Better Auth deliberately excludes from registered private-use URIs.
 * OAuth is completed against this HTTPS callback, then handed to Cursor.
 */
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  if (!isCursorRedirect(redirectUri)) {
    return Response.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }

  const target = new URL(redirectUri);
  for (const name of OAUTH_RESPONSE_PARAMS) {
    const value = url.searchParams.get(name);
    if (value !== null) target.searchParams.set(name, value);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
    },
  });
}
