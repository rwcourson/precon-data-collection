/** Loopback hosts RFC 8252 allows for native OAuth clients. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** Native MCP CLIs need a refresh token so they do not re-open a browser hourly. */
const OFFLINE_ACCESS_SCOPE = "offline_access";

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
  const next: Record<string, unknown> = {
    ...rec,
    application_type: rec.application_type ?? "native",
    token_endpoint_auth_method: rec.token_endpoint_auth_method ?? "none",
  };
  if (typeof rec.scope === "string") {
    next.scope = ensureOfflineAccessScope(rec.scope);
  } else if (rec.scope == null) {
    next.scope = OFFLINE_ACCESS_SCOPE;
  }
  return next;
}

function ensureOfflineAccessScope(scope: string): string {
  const parts = scope.split(/[+\s]+/).filter(Boolean);
  if (!parts.includes(OFFLINE_ACCESS_SCOPE)) parts.push(OFFLINE_ACCESS_SCOPE);
  return parts.join(" ");
}

/**
 * mcp-remote builds the authorize `scope` from resource metadata, which does
 * not advertise OIDC `offline_access`. Without it, Better Auth issues a 1-hour
 * access token and no refresh token, so Grok re-opens a browser every hour and
 * dies on a dead localhost callback. Native loopback clients always get it.
 */
export function rewriteLoopbackAuthorizeUrl(url: URL): URL {
  const redirect = url.searchParams.get("redirect_uri") ?? "";
  if (!isLoopbackRedirect(redirect)) return url;
  const next = new URL(url.toString());
  const current = next.searchParams.get("scope") ?? "";
  const withOffline = ensureOfflineAccessScope(current);
  if (withOffline !== current) next.searchParams.set("scope", withOffline);
  return next;
}
