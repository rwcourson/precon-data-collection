import "server-only";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens, type ApiToken } from "@/db/schema";
import type { ApiTokenScope } from "@/domain/contracts";
import { hashToken, tokenHasScope } from "@/lib/api-tokens";

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
  const now = new Date();
  const [token] = await db
    .update(apiTokens)
    .set({ lastUsedAt: now })
    .where(
      and(
        eq(apiTokens.tokenHash, hash),
        isNull(apiTokens.revokedAt),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now)),
      ),
    )
    .returning();
  if (!token) return { ok: false, status: 401, error: "Invalid, expired, or revoked token" };
  return { ok: true, token };
}

export function requireScopes(
  token: AuthedToken,
  scopes: ApiTokenScope | readonly ApiTokenScope[],
): { ok: true } | { ok: false; status: 403; error: string } {
  if (!tokenHasScope(token.scopes, scopes)) {
    return { ok: false, status: 403, error: "Insufficient token scope" };
  }
  return { ok: true };
}
