import { requireMcpAuth } from "@better-auth/mcp";
import { auth, mcpResourceIdentifier } from "@/lib/auth-server";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";
import { handleMcpWithClaims } from "@/lib/mcp/handler";
import { mcpOAuthChallengeResponse } from "@/lib/mcp/oauth-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 9728 probe — Grok CLI / Linear GET the MCP URL expecting 401 + WWW-Authenticate. */
export function GET(request: Request) {
  return withMcpCors(mcpOAuthChallengeResponse(true), request);
}

export function HEAD(request: Request) {
  return withMcpCors(mcpOAuthChallengeResponse(false), request);
}

const protectedPost = requireMcpAuth(
  auth,
  (request, claims) => handleMcpWithClaims(request, claims),
  { resource: mcpResourceIdentifier() }
);

export async function POST(request: Request) {
  return withMcpCors(await protectedPost(request), request);
}

export function OPTIONS(request: Request) {
  return mcpCorsPreflight(request);
}
