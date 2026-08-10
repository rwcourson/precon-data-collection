/** Better Auth default session cookie name (shared by edge proxy + server). */
export const BA_SESSION_COOKIE = "better-auth.session_token";

/** Secure-prefixed name used on HTTPS (Vercel production). */
export const BA_SESSION_COOKIE_SECURE = `__Secure-${BA_SESSION_COOKIE}`;
