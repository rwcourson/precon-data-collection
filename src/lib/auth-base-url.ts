/**
 * Better Auth `baseURL` for Microsoft OAuth redirects.
 *
 * Hosted deploys stay on the Entra-registered origin. Local `next dev` follows
 * the request Host so leftover `localhost:3001` vs `:3000` env does not send
 * the Microsoft callback to a port that is not listening.
 */

export type AuthBaseURLConfig =
  | string
  | {
      allowedHosts: string[];
      fallback?: string;
      protocol?: "http" | "https" | "auto";
    };

const LOCAL_FALLBACK = "http://localhost:3000";

/** Loopback hosts Entra already has as Web redirect URIs (with and without port). */
export const LOCAL_AUTH_ALLOWED_HOSTS = [
  "localhost",
  "localhost:*",
  "127.0.0.1",
  "127.0.0.1:*",
  "[::1]",
  "[::1]:*",
] as const;

function envValue(
  env: Record<string, string | undefined>,
  name: string
): string {
  return env[name]?.trim() ?? "";
}

function originOf(value: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

export function isHostedAuthRuntime(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (
    Boolean(envValue(env, "VERCEL")) ||
    envValue(env, "APP_ENV") === "production"
  );
}

/**
 * Static origin for MCP resource IDs and logs. Prefer the configured fallback
 * locally; never invent a Vercel alias on production.
 */
export function authPublicOrigin(
  config: AuthBaseURLConfig,
  env: Record<string, string | undefined> = process.env
): string {
  if (typeof config === "string") return config;
  if (config.fallback) return config.fallback.replace(/\/$/, "");
  return originOf(envValue(env, "BETTER_AUTH_URL")) || LOCAL_FALLBACK;
}

export function authBaseURLConfig(
  env: Record<string, string | undefined> = process.env
): AuthBaseURLConfig {
  const explicit =
    originOf(envValue(env, "BETTER_AUTH_URL")) ||
    originOf(envValue(env, "APP_ORIGIN")) ||
    originOf(envValue(env, "NEXT_PUBLIC_APP_URL"));

  if (isHostedAuthRuntime(env)) {
    if (explicit) return explicit;
    const prodHost = envValue(env, "VERCEL_PROJECT_PRODUCTION_URL");
    if (prodHost) {
      return prodHost.startsWith("http")
        ? prodHost.replace(/\/$/, "")
        : `https://${prodHost}`;
    }
    const vercelUrl = envValue(env, "VERCEL_URL");
    if (vercelUrl) {
      return `https://${vercelUrl.replace(/\/$/, "")}`;
    }
    return LOCAL_FALLBACK;
  }

  const fallback =
    explicit && isLoopbackOrigin(explicit) ? explicit : LOCAL_FALLBACK;
  return {
    allowedHosts: [...LOCAL_AUTH_ALLOWED_HOSTS],
    fallback,
    protocol: "http",
  };
}
