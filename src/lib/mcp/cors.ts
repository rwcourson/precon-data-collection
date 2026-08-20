const BUILT_IN_BROWSER_ORIGINS = [
  "https://grok.com",
  "https://www.grok.com",
  "https://claude.ai",
  "https://cursor.com",
] as const;

function allowedOrigins(): Set<string> {
  const configured = [
    process.env.APP_ORIGIN,
    process.env.BETTER_AUTH_URL,
    ...(process.env.ALLOWED_ORIGINS ?? "").split(","),
    ...(process.env.MCP_BROWSER_ORIGINS ?? "").split(","),
    ...BUILT_IN_BROWSER_ORIGINS,
  ];
  return new Set(
    configured.flatMap((value) => {
      if (!value?.trim()) return [];
      try {
        return [new URL(value.trim()).origin];
      } catch {
        return [];
      }
    })
  );
}

export function withMcpCors(response: Response, request?: Request): Response {
  const origin = request?.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set(
    "Access-Control-Expose-Headers",
    "WWW-Authenticate, MCP-Session-Id"
  );
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function mcpCorsPreflight(request: Request): Response {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Accept, MCP-Protocol-Version, DPoP",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}
