import { mcpResourceIdentifier } from "@/lib/auth-server";

/** RFC 9728 path-aware protected-resource metadata URL for `/api/mcp`. */
export function mcpProtectedResourceMetadataUrl(): string {
  const resource = mcpResourceIdentifier();
  const url = new URL(resource);
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`;
}

/**
 * Challenge Grok CLI / Linear-style clients send on GET of the MCP URL.
 * They probe GET first and only treat 401 + `resource_metadata` as OAuth.
 * A 405 leaves the TUI stuck on `[authenticating]` with no browser.
 */
export function mcpOAuthChallengeResponse(body: boolean): Response {
  const metadata = mcpProtectedResourceMetadataUrl();
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    // This route is a credential-less discovery probe. Do not report
    // `invalid_token`: some clients interpret that as an instruction to erase a
    // perfectly reusable cached token before they have attempted an auth POST.
    "WWW-Authenticate": `Bearer realm="OAuth", resource_metadata="${metadata}"`,
  };
  if (!body) {
    return new Response(null, { status: 401, headers });
  }
  return new Response(
    JSON.stringify({
      error: "authorization_required",
      error_description: "A bearer access token is required",
    }),
    { status: 401, headers }
  );
}
