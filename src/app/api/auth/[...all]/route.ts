import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth-server";
import { rewriteLoopbackDcrBody } from "@/lib/mcp/dcr-native";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  const path = new URL(request.url).pathname;
  if (path.endsWith("/oauth2/register")) {
    const json = await request.json().catch(() => null);
    const rewritten = rewriteLoopbackDcrBody(json);
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    request = new Request(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify(rewritten),
      // Node fetch requires duplex when a Request is constructed with a body.
      duplex: "half",
    } as RequestInit);
  }
  return handler.POST(request);
}
