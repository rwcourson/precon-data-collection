export type PreviewIsolationIssue = {
  key: string;
  reason: string;
};

function databaseIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Preview must never share Production Neon. Demo personas against Production
 * would be a data incident; fail closed when the two URLs match or the
 * comparison target is missing.
 */
export function previewDatabaseIsolationIssue(
  env: Record<string, string | undefined>
): PreviewIsolationIssue | null {
  if (env.VERCEL_ENV?.trim() !== "preview") return null;
  if (env.DATABASE_MODE?.trim() === "pglite") return null;
  const previewUrl = env.DATABASE_URL?.trim();
  const productionUrl = env.PRODUCTION_DATABASE_URL?.trim();
  if (!previewUrl) {
    return { key: "DATABASE_URL", reason: "is required on Preview deploys" };
  }
  if (!productionUrl) {
    return {
      key: "PRODUCTION_DATABASE_URL",
      reason:
        "must be set on Preview so the deploy can prove it is not Production Neon",
    };
  }
  if (databaseIdentity(previewUrl) === databaseIdentity(productionUrl)) {
    return {
      key: "DATABASE_URL",
      reason: "Preview must use a database isolated from Production",
    };
  }
  return null;
}
