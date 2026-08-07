import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens, type ApiToken } from "@/db/schema";
import type { ApiTokenScope } from "@/domain/contracts";
import { hashToken, tokenHasScope, tokenIsExpired } from "@/lib/api-tokens";

export type AuthedToken = ApiToken;

export async function authenticateBearer(
  authHeader: string | null,
): Promise<{ ok: true; token: AuthedToken } | { ok: false; status: 401 | 403; error: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }
  const plaintext = authHeader.slice("Bearer ".length).trim();
  if (!plaintext) return { ok: false, status: 401, error: "Missing bearer token" };

  const hash = hashToken(plaintext);
  const [token] = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, hash));
  if (!token || token.revokedAt) {
    return { ok: false, status: 401, error: "Invalid or revoked token" };
  }
  if (tokenIsExpired(token.expiresAt)) {
    return { ok: false, status: 401, error: "Token expired" };
  }
  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, token.id));
  return { ok: true, token };
}

export function requireScopes(
  token: AuthedToken,
  scopes: ApiTokenScope | ApiTokenScope[],
): { ok: true } | { ok: false; status: 403; error: string } {
  if (!tokenHasScope(token.scopes, scopes)) {
    return { ok: false, status: 403, error: "Insufficient token scope" };
  }
  return { ok: true };
}
