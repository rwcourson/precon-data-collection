"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens, auditLog } from "@/db/schema";
import { createApiTokenSchema } from "@/domain/contracts";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { generateApiTokenSecret, validateTokenExpiry } from "@/lib/api-tokens";
import { assertPrincipalAdmin } from "@/services/mutation-policy";
import { getRuntimeConfig } from "@/lib/runtime-config";

export async function createApiToken(raw: unknown) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "tokens", "manage", "API token");
  const user = principal.user;
  const input = createApiTokenSchema.parse(raw);
  const expiresAt = new Date(input.expiresAt);
  const expiry = validateTokenExpiry(expiresAt, getRuntimeConfig().apiTokenMaxTtlDays);
  if (!expiry.ok) throw new Error(expiry.reason);
  const { plaintext, prefix, hash } = generateApiTokenSecret();
  const [row] = await db
    .insert(apiTokens)
    .values({
      name: input.name,
      tokenHash: hash,
      tokenPrefix: prefix,
      scopes: input.scopes,
      regionAllowlist: input.regionAllowlist,
      createdById: user.id,
      expiresAt,
    })
    .returning();

  await db.insert(auditLog).values({
    entity: "api_token",
    entityId: row.id,
    action: "created",
    field: row.name,
    newValue: prefix,
    userId: user.id,
  });
  revalidatePath("/admin");
  return { id: row.id, token: plaintext, prefix };
}

export async function revokeApiToken(id: number) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "tokens", "manage", "API token");
  const user = principal.user;
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(eq(apiTokens.id, id));
  await db.insert(auditLog).values({
    entity: "api_token",
    entityId: id,
    action: "revoked",
    userId: user.id,
  });
  revalidatePath("/admin");
}
