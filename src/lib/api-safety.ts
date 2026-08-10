import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, type AppDb } from "@/db";
import {
  apiDestructiveChallenges,
  apiIdempotencyKeys,
  type ApiToken,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { generateDestructiveChallenge } from "@/lib/api-tokens";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

export function payloadHash(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function secretHash(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export async function createDestructiveChallenge(input: {
  token: ApiToken;
  operation: string;
  target: string;
  payload: unknown;
  ttlMs?: number;
}) {
  const challenge = generateDestructiveChallenge();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 5 * 60 * 1000));
  await db.insert(apiDestructiveChallenges).values({
    tokenId: input.token.id,
    actorId: input.token.createdById,
    challengeHash: secretHash(challenge),
    operation: input.operation,
    target: input.target,
    payloadHash: payloadHash(input.payload),
    expiresAt,
  });
  return { challenge, expiresAt };
}

export async function withDestructiveChallenge<T>(
  input: {
    token: ApiToken;
    challenge: string;
    operation: string;
    target: string;
    payload: unknown;
    now?: Date;
  },
  mutate: (tx: AppDb) => Promise<T>,
): Promise<T> {
  const now = input.now ?? new Date();
  return db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as AppDb;
    const [consumed] = await tx
      .update(apiDestructiveChallenges)
      .set({ usedAt: now })
      .where(
        and(
          eq(apiDestructiveChallenges.tokenId, input.token.id),
          eq(apiDestructiveChallenges.actorId, input.token.createdById),
          eq(apiDestructiveChallenges.challengeHash, secretHash(input.challenge)),
          eq(apiDestructiveChallenges.operation, input.operation),
          eq(apiDestructiveChallenges.target, input.target),
          eq(apiDestructiveChallenges.payloadHash, payloadHash(input.payload)),
          isNull(apiDestructiveChallenges.usedAt),
          gt(apiDestructiveChallenges.expiresAt, now),
        ),
      )
      .returning({ id: apiDestructiveChallenges.id });
    if (!consumed) {
      throw DomainError.conflict(
        "Destructive challenge is invalid, expired, mismatched, or already used.",
      );
    }
    return mutate(tx);
  });
}

export type IdempotentResponse<T extends Record<string, unknown>> = {
  status: number;
  body: T;
  replayed: boolean;
};

export async function executeIdempotent<T extends Record<string, unknown>>(
  input: {
    tokenId: number;
    key: string;
    operation: string;
    payload: unknown;
  },
  execute: (tx: AppDb) => Promise<{ status: number; body: T }>,
): Promise<IdempotentResponse<T>> {
  const key = input.key.trim();
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(key)) {
    throw DomainError.badRequest("Idempotency-Key must contain 8–160 safe characters.");
  }
  const hash = payloadHash(input.payload);
  return db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as AppDb;
    const [reservation] = await tx
      .insert(apiIdempotencyKeys)
      .values({
        tokenId: input.tokenId,
        key,
        operation: input.operation,
        payloadHash: hash,
        responseStatus: 0,
        responseBody: { state: "pending" },
      })
      .onConflictDoNothing({ target: [apiIdempotencyKeys.tokenId, apiIdempotencyKeys.key] })
      .returning({ id: apiIdempotencyKeys.id });

    if (!reservation) {
      const [existing] = await tx
        .select()
        .from(apiIdempotencyKeys)
        .where(and(eq(apiIdempotencyKeys.tokenId, input.tokenId), eq(apiIdempotencyKeys.key, key)));
      if (!existing || existing.operation !== input.operation || existing.payloadHash !== hash) {
        throw DomainError.conflict("Idempotency key was already used for a different request.");
      }
      if (existing.responseStatus === 0) {
        throw DomainError.conflict("Idempotent request is still in progress.");
      }
      return {
        status: existing.responseStatus,
        body: existing.responseBody as T,
        replayed: true,
      };
    }

    const result = await execute(tx);
    await tx
      .update(apiIdempotencyKeys)
      .set({ responseStatus: result.status, responseBody: result.body })
      .where(eq(apiIdempotencyKeys.id, reservation.id));
    return { ...result, replayed: false };
  });
}
