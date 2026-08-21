/** Better Auth default session cookie name (shared by edge proxy + server). */
export const BA_SESSION_COOKIE = "better-auth.session_token";

/** Secure-prefixed name used on HTTPS (Vercel production). */
export const BA_SESSION_COOKIE_SECURE = `__Secure-${BA_SESSION_COOKIE}`;

/**
 * Cookie presence only — not a validated session.
 * `(app)/layout` still calls Better Auth `getSession` before rendering chrome.
 */
export function cookiesLookLikeBetterAuthSession(
  cookies: Iterable<{ name: string; value: string }>
): boolean {
  for (const cookie of cookies) {
    if (cookie.value && cookie.name.includes("session_token")) return true;
  }
  return false;
}
