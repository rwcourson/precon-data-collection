export type AppEnvironment = "local" | "demo" | "production";
export type RuntimeAuthMode = "demo" | "sso";
export type DatabaseMode = "pglite" | "postgres";
export type EmailMode = "stub" | "resend";
export type PrivateStorageMode = "local" | "vercel-blob";
export type ConnectMode = "disabled" | "mock" | "rest";
export type SmartsheetMode = "disabled" | "api";
export type DatabricksMode = "disabled" | "sql";

export type RuntimeConfigIssue = {
  key: string;
  reason: string;
};

export type RuntimeConfig = {
  appEnv: AppEnvironment;
  authMode: RuntimeAuthMode;
  database:
    | { mode: "pglite"; dataDir: string }
    | { mode: "postgres"; url: string; unpooledUrl?: string };
  appOrigin: string;
  allowedOrigins: string[];
  cronSecret?: string;
  /** Optional legacy proxy hop secret; primary SSO is Better Auth + Microsoft. */
  ssoTrustSecret?: string;
  ssoAllowedDomains: string[];
  betterAuthSecret?: string;
  betterAuthUrl?: string;
  microsoftClientId?: string;
  microsoftClientSecret?: string;
  microsoftTenantId?: string;
  apiTokenMaxTtlDays: number;
  email:
    | { mode: "stub" }
    | { mode: "resend"; apiKey: string; from: string };
  storage:
    | { mode: "local" }
    | { mode: "vercel-blob"; token: string };
  integrations: {
    connect: ConnectMode;
    smartsheet: SmartsheetMode;
    databricks: DatabricksMode;
  };
};

export type RuntimeConfigStatus =
  | { ok: true; config: RuntimeConfig; issues: [] }
  | { ok: false; config: null; issues: RuntimeConfigIssue[] };

export class RuntimeConfigError extends Error {
  readonly issues: RuntimeConfigIssue[];

  constructor(issues: RuntimeConfigIssue[]) {
    super(`Runtime configuration is invalid (${issues.map((issue) => issue.key).join(", ")})`);
    this.name = "RuntimeConfigError";
    this.issues = issues;
  }
}

type RuntimeEnvironment = Record<string, string | undefined>;

function oneOf<T extends string>(
  env: RuntimeEnvironment,
  key: string,
  values: readonly T[],
  issues: RuntimeConfigIssue[],
): T | undefined {
  const value = env[key]?.trim();
  if (value && values.includes(value as T)) return value as T;
  issues.push({ key, reason: `must be one of ${values.join(", ")}` });
  return undefined;
}

function required(
  env: RuntimeEnvironment,
  key: string,
  issues: RuntimeConfigIssue[],
  minimumLength = 1,
): string | undefined {
  const value = env[key]?.trim();
  if (value && value.length >= minimumLength) return value;
  issues.push({ key, reason: minimumLength > 1 ? `must contain at least ${minimumLength} characters` : "is required" });
  return undefined;
}

function parsedUrl(
  env: RuntimeEnvironment,
  key: string,
  protocols: readonly string[],
  issues: RuntimeConfigIssue[],
  requiredValue = true,
): string | undefined {
  const value = env[key]?.trim();
  if (!value) {
    if (requiredValue) issues.push({ key, reason: "is required" });
    return undefined;
  }
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) throw new Error("protocol");
    return value;
  } catch {
    issues.push({ key, reason: `must be a valid ${protocols.join(" or ")} URL` });
    return undefined;
  }
}

function boundedInteger(
  env: RuntimeEnvironment,
  key: string,
  minimum: number,
  maximum: number,
  issues: RuntimeConfigIssue[],
): number | undefined {
  const raw = env[key]?.trim();
  const value = raw ? Number(raw) : Number.NaN;
  if (Number.isInteger(value) && value >= minimum && value <= maximum) return value;
  issues.push({ key, reason: `must be an integer from ${minimum} to ${maximum}` });
  return undefined;
}

function originList(
  env: RuntimeEnvironment,
  appOrigin: string | undefined,
  production: boolean,
  issues: RuntimeConfigIssue[],
): string[] {
  const raw = env.ALLOWED_ORIGINS?.trim();
  if (!raw) {
    issues.push({ key: "ALLOWED_ORIGINS", reason: "is required" });
    return [];
  }
  const origins: string[] = [];
  for (const candidate of raw.split(",").map((value) => value.trim()).filter(Boolean)) {
    try {
      const url = new URL(candidate);
      if (url.origin !== candidate || (production && url.protocol !== "https:")) {
        throw new Error("origin");
      }
      origins.push(candidate);
    } catch {
      issues.push({ key: "ALLOWED_ORIGINS", reason: "must contain only absolute origins" });
      return [];
    }
  }
  if (appOrigin && !origins.includes(new URL(appOrigin).origin)) {
    issues.push({ key: "ALLOWED_ORIGINS", reason: "must include APP_ORIGIN" });
  }
  return [...new Set(origins)];
}

export function inspectRuntimeConfig(
  env: RuntimeEnvironment = process.env,
): RuntimeConfigStatus {
  const issues: RuntimeConfigIssue[] = [];
  const appEnv = oneOf(env, "APP_ENV", ["local", "demo", "production"] as const, issues);
  const production = appEnv === "production";
  const authMode = oneOf(env, "AUTH_MODE", ["demo", "sso"] as const, issues);
  const databaseMode = oneOf(env, "DATABASE_MODE", ["pglite", "postgres"] as const, issues);
  const emailMode = oneOf(env, "EMAIL_MODE", ["stub", "resend"] as const, issues);
  const storageMode = oneOf(
    env,
    "PRIVATE_STORAGE_MODE",
    ["local", "vercel-blob"] as const,
    issues,
  );
  const connect = oneOf(env, "CONNECT_MODE", ["disabled", "mock", "rest"] as const, issues);
  const smartsheet = oneOf(env, "SMARTSHEET_MODE", ["disabled", "api"] as const, issues);
  const databricks = oneOf(env, "DATABRICKS_MODE", ["disabled", "sql"] as const, issues);

  const appOrigin = parsedUrl(env, "APP_ORIGIN", production ? ["https:"] : ["http:", "https:"], issues);
  const allowedOrigins = originList(env, appOrigin, production, issues);

  // Full production (APP_ENV=production) requires SSO, Resend, Blob, etc.
  // Hosted Magnus may still run APP_ENV=local with Postgres + demo auth until SSO is ready.
  // Only forbid that combination when APP_ENV is explicitly production.
  if (production && authMode !== "sso") {
    issues.push({ key: "AUTH_MODE", reason: "must be sso in production" });
  }
  if (appEnv === "demo" && authMode !== "demo") {
    issues.push({ key: "AUTH_MODE", reason: "must be demo in the demo environment" });
  }

  let database: RuntimeConfig["database"] | undefined;
  if (databaseMode === "pglite") {
    const dataDir = required(env, "PGLITE_DATA_DIR", issues);
    // PGlite is never valid on Vercel (ephemeral filesystem) regardless of APP_ENV.
    if (production || env.VERCEL_ENV === "production" || env.VERCEL === "1") {
      issues.push({ key: "DATABASE_MODE", reason: "PGlite is forbidden on Vercel; use postgres" });
    }
    if (dataDir) database = { mode: "pglite", dataDir };
  } else if (databaseMode === "postgres") {
    const url = parsedUrl(env, "DATABASE_URL", ["postgres:", "postgresql:"], issues);
    const unpooledUrl = parsedUrl(
      env,
      "DATABASE_URL_UNPOOLED",
      ["postgres:", "postgresql:"],
      issues,
      production,
    );
    if (url) database = { mode: "postgres", url, ...(unpooledUrl ? { unpooledUrl } : {}) };
  }
  if (production && databaseMode !== "postgres") {
    issues.push({ key: "DATABASE_MODE", reason: "must be postgres in production" });
    if (!env.DATABASE_URL?.trim()) {
      issues.push({ key: "DATABASE_URL", reason: "is required in production" });
    }
    if (!env.DATABASE_URL_UNPOOLED?.trim()) {
      issues.push({ key: "DATABASE_URL_UNPOOLED", reason: "is required in production" });
    }
  }

  const cronSecret = production
    ? required(env, "CRON_SECRET", issues, 32)
    : env.CRON_SECRET?.trim() || undefined;
  // Legacy authenticating-proxy secret (optional). Primary SSO is Better Auth Microsoft.
  const ssoTrustSecret = env.SSO_TRUST_SECRET?.trim() || undefined;
  const rawDomains = env.SSO_ALLOWED_DOMAINS?.trim();
  const ssoAllowedDomains = rawDomains
    ? [...new Set(rawDomains.split(",").map((domain) => domain.trim().toLowerCase()).filter(Boolean))]
    : [];
  if ((production || authMode === "sso") && ssoAllowedDomains.length === 0) {
    issues.push({ key: "SSO_ALLOWED_DOMAINS", reason: "is required when AUTH_MODE=sso" });
  }
  if (ssoAllowedDomains.some((domain) => !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain))) {
    issues.push({ key: "SSO_ALLOWED_DOMAINS", reason: "must contain comma-separated DNS domains" });
  }

  let betterAuthSecret: string | undefined;
  let betterAuthUrl: string | undefined;
  let microsoftClientId: string | undefined;
  let microsoftClientSecret: string | undefined;
  let microsoftTenantId: string | undefined;
  if (authMode === "sso") {
    betterAuthSecret = required(env, "BETTER_AUTH_SECRET", issues, 32);
    betterAuthUrl =
      parsedUrl(env, "BETTER_AUTH_URL", production ? ["https:"] : ["http:", "https:"], issues, false) ||
      appOrigin;
    if (!betterAuthUrl) {
      issues.push({ key: "BETTER_AUTH_URL", reason: "is required when AUTH_MODE=sso (or set APP_ORIGIN)" });
    }
    microsoftClientId = required(env, "MICROSOFT_CLIENT_ID", issues, 8);
    microsoftClientSecret = required(env, "MICROSOFT_CLIENT_SECRET", issues, 8);
    microsoftTenantId = required(env, "MICROSOFT_TENANT_ID", issues, 8);
  }

  const apiTokenMaxTtlDays = boundedInteger(env, "API_TOKEN_MAX_TTL_DAYS", 1, 365, issues);

  let email: RuntimeConfig["email"] | undefined;
  if (emailMode === "stub") {
    email = { mode: "stub" };
    if (production) issues.push({ key: "EMAIL_MODE", reason: "stub delivery is forbidden in production" });
  } else if (emailMode === "resend") {
    const apiKey = required(env, "RESEND_API_KEY", issues, 12);
    const from = required(env, "EMAIL_FROM", issues);
    if (from && !/^\S+@\S+\.\S+$/.test(from)) {
      issues.push({ key: "EMAIL_FROM", reason: "must be an email address" });
    }
    if (apiKey && from) email = { mode: "resend", apiKey, from };
  }

  let storage: RuntimeConfig["storage"] | undefined;
  if (storageMode === "local") {
    storage = { mode: "local" };
    if (production) issues.push({ key: "PRIVATE_STORAGE_MODE", reason: "local storage is forbidden in production" });
  } else if (storageMode === "vercel-blob") {
    const token = required(env, "BLOB_READ_WRITE_TOKEN", issues, 12);
    if (token) storage = { mode: "vercel-blob", token };
  }

  if (production && connect === "mock") {
    issues.push({ key: "CONNECT_MODE", reason: "mock integration is forbidden in production" });
  }
  if (connect === "rest") {
    parsedUrl(env, "CONNECT_API_URL", production ? ["https:"] : ["http:", "https:"], issues);
    required(env, "CONNECT_API_TOKEN", issues, 12);
  }
  if (smartsheet === "api") required(env, "SMARTSHEET_ACCESS_TOKEN", issues, 12);
  if (databricks === "sql") {
    parsedUrl(env, "DATABRICKS_HOST", ["https:"], issues);
    required(env, "DATABRICKS_TOKEN", issues, 12);
    required(env, "DATABRICKS_WAREHOUSE_ID", issues);
  }

  if (
    issues.length > 0 ||
    !appEnv ||
    !authMode ||
    !database ||
    !appOrigin ||
    !email ||
    !storage ||
    !apiTokenMaxTtlDays ||
    !connect ||
    !smartsheet ||
    !databricks
  ) {
    const unique = new Map(issues.map((issue) => [`${issue.key}:${issue.reason}`, issue]));
    return { ok: false, config: null, issues: [...unique.values()] };
  }

  return {
    ok: true,
    issues: [],
    config: {
      appEnv,
      authMode,
      database,
      appOrigin,
      allowedOrigins,
      cronSecret,
      ssoTrustSecret,
      ssoAllowedDomains,
      betterAuthSecret,
      betterAuthUrl,
      microsoftClientId,
      microsoftClientSecret,
      microsoftTenantId,
      apiTokenMaxTtlDays,
      email,
      storage,
      integrations: { connect, smartsheet, databricks },
    },
  };
}

export function getRuntimeConfig(env: RuntimeEnvironment = process.env): RuntimeConfig {
  const status = inspectRuntimeConfig(env);
  if (!status.ok) throw new RuntimeConfigError(status.issues);
  return status.config;
}

export function runtimeDiagnostics(status: RuntimeConfigStatus) {
  if (!status.ok) {
    return {
      configuration: "invalid" as const,
      issueKeys: [...new Set(status.issues.map((issue) => issue.key))].sort(),
    };
  }
  return {
    configuration: "valid" as const,
    appEnv: status.config.appEnv,
    authMode: status.config.authMode,
    databaseMode: status.config.database.mode,
    emailMode: status.config.email.mode,
    storageMode: status.config.storage.mode,
    integrations: status.config.integrations,
  };
}

export function assertDemoSeedAllowed(env: RuntimeEnvironment = process.env): void {
  const status = inspectRuntimeConfig(env);
  if (!status.ok) throw new RuntimeConfigError(status.issues);
  if (status.config.appEnv !== "demo") {
    throw new RuntimeConfigError([{ key: "APP_ENV", reason: "must be demo to seed" }]);
  }
  if (status.config.database.mode !== "pglite") {
    throw new RuntimeConfigError([{ key: "DATABASE_MODE", reason: "must be pglite to seed demo data" }]);
  }
  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl && /^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new RuntimeConfigError([{ key: "DATABASE_URL", reason: "hosted Postgres is forbidden for demo seeding" }]);
  }
}
