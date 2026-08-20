import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth-server";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = oauthProviderAuthServerMetadata(auth);

async function handle(request: Request) {
  return withMcpCors(await handler(request), request);
}

export const GET = handle;
export const HEAD = handle;

export function OPTIONS(request: Request) {
  return mcpCorsPreflight(request);
}
