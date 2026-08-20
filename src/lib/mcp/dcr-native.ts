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
  const next: Record<string, unknown> = { ...rec };
  if (typeof rec.scope === "string") {
    next.scope = ensureOfflineAccessScope(rec.scope);
  } else if (rec.scope == null) {
    next.scope = OFFLINE_ACCESS_SCOPE;
  }
  if (!Array.isArray(uris) || uris.length === 0) return next;
  const allLoopback = uris.every(
    (uri) => typeof uri === "string" && isLoopbackRedirect(uri)
  );
  if (allLoopback) {
    next.application_type = rec.application_type ?? "native";
    next.token_endpoint_auth_method = rec.token_endpoint_auth_method ?? "none";
  }
  return next;
}

function ensureOfflineAccessScope(scope: string): string {
  const parts = scope.split(/[+\s]+/).filter(Boolean);
  if (!parts.includes(OFFLINE_ACCESS_SCOPE)) parts.push(OFFLINE_ACCESS_SCOPE);
  return parts.join(" ");
}

/**
 * MCP clients commonly build authorize scope from protected-resource metadata,
 * which correctly omits the OAuth protocol scope `offline_access`. Add it at
 * the authorization server so both native and HTTPS clients receive a refresh
 * token instead of opening a browser again after the one-hour access token.
 */
export function rewriteLoopbackAuthorizeUrl(url: URL): URL {
  const next = new URL(url.toString());
  const current = next.searchParams.get("scope") ?? "";
  const withOffline = ensureOfflineAccessScope(current);
  if (withOffline !== current) next.searchParams.set("scope", withOffline);
  return next;
}
