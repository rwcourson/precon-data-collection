import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth-server";
import {
  rewriteLoopbackAuthorizeUrl,
  rewriteLoopbackDcrBody,
} from "@/lib/mcp/dcr-native";

const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/oauth2/authorize")) {
    const next = rewriteLoopbackAuthorizeUrl(url);
    if (next.toString() !== url.toString()) {
      request = new Request(next.toString(), {
        method: "GET",
        headers: request.headers,
      });
    }
  }
  return handler.GET(request);
}

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
