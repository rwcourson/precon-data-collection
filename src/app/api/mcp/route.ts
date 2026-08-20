import { requireMcpAuth } from "@better-auth/mcp";
import { auth, mcpResourceIdentifier } from "@/lib/auth-server";
import { handleMcpWithClaims } from "@/lib/mcp/handler";
import { mcpOAuthChallengeResponse } from "@/lib/mcp/oauth-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 9728 probe — Grok CLI / Linear GET the MCP URL expecting 401 + WWW-Authenticate. */
export function GET() {
  return mcpOAuthChallengeResponse(true);
}

export function HEAD() {
  return mcpOAuthChallengeResponse(false);
}

export const POST = requireMcpAuth(
  auth,
  (request, claims) => handleMcpWithClaims(request, claims),
  { resource: mcpResourceIdentifier() }
);
