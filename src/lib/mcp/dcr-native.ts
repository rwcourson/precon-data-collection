/** Loopback hosts RFC 8252 allows for native OAuth clients. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** Native MCP CLIs need a refresh token so they do not re-open a browser hourly. */
const OFFLINE_ACCESS_SCOPE = "offline_access";
const CURSOR_REDIRECT_URI = "cursor://anysphere.cursor-mcp/oauth/callback";

export function isLoopbackRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol !== "http:") return false;
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isCursorRedirect(uri: string): boolean {
  return uri === CURSOR_REDIRECT_URI;
}

/** Native MCP clients: HTTP loopback and Cursor's fixed private-use callback. */
export function isNativeRedirect(uri: string): boolean {
  return isLoopbackRedirect(uri) || isCursorRedirect(uri);
}

/**
 * Better Auth intentionally rejects private-use URIs with a naming authority,
 * while Cursor's fixed callback uses exactly that shape. Register a same-origin
 * HTTPS trampoline and translate it back to Cursor after authorization.
 */
export function bridgeCursorRedirect(uri: string, origin: string): string {
  if (!isCursorRedirect(uri)) return uri;
  const callback = new URL("/api/auth/native-callback", origin);
  callback.searchParams.set("redirect_uri", uri);
  return callback.toString();
}

/**
 * Better Auth DCR defaults `application_type` to `web`, which rejects
 * `http://127.0.0.1` and `http://localhost` redirects. Cursor Desktop also
 * sends `application_type: "web"` with those URIs. Force native when every
 * redirect is loopback HTTP or Cursor's private-use callback.
 */
export function rewriteLoopbackDcrBody(
  body: unknown,
  origin?: string
): unknown {
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
  const stringUris = uris.filter(
    (uri): uri is string => typeof uri === "string"
  );
  if (stringUris.length !== uris.length) return next;
  // Cursor Desktop often sends application_type=web with localhost and/or
  // cursor:// callbacks. Better Auth then rejects both. Force native when
  // every redirect is a native-eligible URI.
  if (!stringUris.every(isNativeRedirect)) return next;
  next.application_type = "native";
  next.token_endpoint_auth_method = rec.token_endpoint_auth_method ?? "none";
  if (origin && stringUris.some(isCursorRedirect)) {
    next.redirect_uris = stringUris.map((uri) =>
      bridgeCursorRedirect(uri, origin)
    );
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
  const redirect = next.searchParams.get("redirect_uri");
  if (redirect && isCursorRedirect(redirect)) {
    next.searchParams.set(
      "redirect_uri",
      bridgeCursorRedirect(redirect, next.origin)
    );
  }
  const current = next.searchParams.get("scope") ?? "";
  const withOffline = ensureOfflineAccessScope(current);
  if (withOffline !== current) next.searchParams.set("scope", withOffline);
  return next;
}

export function rewriteCursorTokenBody(
  body: URLSearchParams,
  origin: string
): URLSearchParams {
  const next = new URLSearchParams(body);
  const redirect = next.get("redirect_uri");
  if (redirect && isCursorRedirect(redirect)) {
    next.set("redirect_uri", bridgeCursorRedirect(redirect, origin));
  }
  return next;
}
