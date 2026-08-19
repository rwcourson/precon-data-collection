import { requireMcpAuth } from "@better-auth/mcp";
import { auth, mcpResourceIdentifier } from "@/lib/auth-server";
import { handleMcpWithClaims } from "@/lib/mcp/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = requireMcpAuth(
  auth,
  (request, claims) => handleMcpWithClaims(request, claims),
  { resource: mcpResourceIdentifier() }
);
