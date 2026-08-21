import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth-server";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";
import {
  rewriteCursorTokenBody,
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
  return withMcpCors(await handler.GET(request), request);
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const path = requestUrl.pathname;
  if (path.endsWith("/oauth2/register")) {
    const json = await request.json().catch(() => null);
    const rewritten = rewriteLoopbackDcrBody(json, requestUrl.origin);
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    request = new Request(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify(rewritten),
      // Node fetch requires duplex when a Request is constructed with a body.
      duplex: "half",
    } as RequestInit);
  } else if (
    path.endsWith("/oauth2/token") &&
    request.headers
      .get("content-type")
      ?.includes("application/x-www-form-urlencoded")
  ) {
    const form = new URLSearchParams(await request.text());
    const rewritten = rewriteCursorTokenBody(form, requestUrl.origin);
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    request = new Request(request.url, {
      method: "POST",
      headers,
      body: rewritten,
      duplex: "half",
    } as RequestInit);
  }
  return withMcpCors(await handler.POST(request), request);
}

export function OPTIONS(request: Request) {
  return mcpCorsPreflight(request);
}
