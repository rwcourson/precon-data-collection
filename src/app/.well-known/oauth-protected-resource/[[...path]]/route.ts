import { auth } from "@/lib/auth-server";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  return withMcpCors(await auth.handler(request), request);
}

export const GET = handle;
export const HEAD = handle;

export function OPTIONS(request: Request) {
  return mcpCorsPreflight(request);
}
