import { createHash, randomBytes } from "crypto";
import type { ApiTokenScope } from "@/domain/contracts";

export function generateApiTokenSecret(): { plaintext: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  const plaintext = `pcn_${raw}`;
  const prefix = plaintext.slice(0, 12);
  return { plaintext, prefix, hash: hashToken(plaintext) };
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function tokenIsExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}

export function validateTokenExpiry(
  expiresAt: Date,
  maxTtlDays: number,
  now = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "Token expiry must be in the future." };
  }
  const maximum = now.getTime() + maxTtlDays * 24 * 60 * 60 * 1000;
  if (expiresAt.getTime() > maximum) {
    return { ok: false, reason: `Token expiry cannot exceed ${maxTtlDays} days.` };
  }
  return { ok: true };
}

export function tokenHasScope(
  scopes: string[] | null | undefined,
  needed: ApiTokenScope | readonly ApiTokenScope[],
): boolean {
  const have = new Set(scopes ?? []);
  const need = Array.isArray(needed) ? needed : [needed];
  return need.every((s) => have.has(s));
}

export function generateDestructiveChallenge(): string {
  return randomBytes(16).toString("hex");
}
