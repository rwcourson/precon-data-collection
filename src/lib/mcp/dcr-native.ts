/** Loopback hosts RFC 8252 allows for native OAuth clients. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export function isLoopbackRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol !== "http:") return false;
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Better Auth DCR defaults `application_type` to `web`, which rejects
 * `http://127.0.0.1` redirects. Local MCP CLIs (Grok, Inspector) omit the
 * field and then never reach the browser authorize step.
 */
export function rewriteLoopbackDcrBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const rec = body as Record<string, unknown>;
  const uris = rec.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0) return rec;
  const allLoopback = uris.every(
    (uri) => typeof uri === "string" && isLoopbackRedirect(uri)
  );
  if (!allLoopback) return rec;
  return {
    ...rec,
    application_type: rec.application_type ?? "native",
    token_endpoint_auth_method: rec.token_endpoint_auth_method ?? "none",
  };
}
