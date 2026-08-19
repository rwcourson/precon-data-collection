import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  user as authUser,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
} from "@/db/auth-schema";

export type McpConnection = {
  consentId: string;
  clientId: string;
  clientName: string;
  clientIcon: string | null;
  userId: string | null;
  scopes: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  userEmail: string | null;
};

export async function listMcpConnections(opts?: {
  authUserId?: string;
}): Promise<McpConnection[]> {
  const base = db
    .select({
      consentId: oauthConsent.id,
      clientId: oauthConsent.clientId,
      userId: oauthConsent.userId,
      scopes: oauthConsent.scopes,
      createdAt: oauthConsent.createdAt,
      clientName: oauthClient.name,
      clientIcon: oauthClient.icon,
      userEmail: authUser.email,
    })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthConsent.clientId, oauthClient.clientId))
    .leftJoin(authUser, eq(oauthConsent.userId, authUser.id));
  const rows = opts?.authUserId
    ? await base.where(eq(oauthConsent.userId, opts.authUserId))
    : await base;

  const connections: McpConnection[] = [];
  for (const row of rows) {
    const [latest] = await db
      .select({ createdAt: oauthAccessToken.createdAt })
      .from(oauthAccessToken)
      .where(
        and(
          eq(oauthAccessToken.clientId, row.clientId),
          row.userId
            ? eq(oauthAccessToken.userId, row.userId)
            : isNull(oauthAccessToken.userId)
        )
      )
      .orderBy(desc(oauthAccessToken.createdAt))
      .limit(1);
    connections.push({
      consentId: row.consentId,
      clientId: row.clientId,
      clientName: row.clientName ?? row.clientId,
      clientIcon: row.clientIcon ?? null,
      userId: row.userId,
      scopes: row.scopes ?? [],
      createdAt: row.createdAt,
      lastUsedAt: latest?.createdAt ?? row.createdAt,
      userEmail: row.userEmail ?? null,
    });
  }
  return connections;
}

export async function revokeMcpConsent(consentId: string): Promise<boolean> {
  const [consent] = await db
    .select()
    .from(oauthConsent)
    .where(sql`${oauthConsent.id} = ${consentId}`)
    .limit(1);
  if (!consent) return false;

  const now = new Date();
  if (consent.userId) {
    await db
      .update(oauthAccessToken)
      .set({ revoked: now })
      .where(
        and(
          eq(oauthAccessToken.clientId, consent.clientId),
          eq(oauthAccessToken.userId, consent.userId)
        )
      );
    await db
      .update(oauthRefreshToken)
      .set({ revoked: now })
      .where(
        and(
          eq(oauthRefreshToken.clientId, consent.clientId),
          eq(oauthRefreshToken.userId, consent.userId)
        )
      );
  } else {
    await db
      .update(oauthAccessToken)
      .set({ revoked: now })
      .where(eq(oauthAccessToken.clientId, consent.clientId));
  }
  await db.delete(oauthConsent).where(sql`${oauthConsent.id} = ${consentId}`);
  return true;
}

export async function accessTokenIsRevoked(tokenRef: string): Promise<boolean> {
  const [byId] = await db
    .select({ revoked: oauthAccessToken.revoked })
    .from(oauthAccessToken)
    .where(sql`${oauthAccessToken.id} = ${tokenRef}`)
    .limit(1);
  if (byId) return byId.revoked != null;
  const [byToken] = await db
    .select({ revoked: oauthAccessToken.revoked })
    .from(oauthAccessToken)
    .where(eq(oauthAccessToken.token, tokenRef))
    .limit(1);
  return byToken?.revoked != null;
}
