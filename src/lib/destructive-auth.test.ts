import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  type ApiToken,
  apiDestructiveChallenges,
  apiIdempotencyKeys,
  apiTokens,
  auditLog,
  users,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import {
  createDestructiveChallenge,
  executeIdempotent,
  payloadHash,
  withDestructiveChallenge,
} from "@/lib/api-safety";
import { generateApiTokenSecret } from "@/lib/api-tokens";

let token: ApiToken;

beforeAll(async () => {
  const [owner] = await db
    .select()
    .from(users)
    .where(eq(users.role, "corporate_admin"));
  const secret = generateApiTokenSecret();
  [token] = await db
    .insert(apiTokens)
    .values({
      name: "phase4-destructive",
      tokenHash: secret.hash,
      tokenPrefix: secret.prefix,
      scopes: ["write:destructive"],
      regionAllowlist: [],
      createdById: owner.id,
      expiresAt: new Date(Date.now() + 60_000),
    })
    .returning();
});

afterAll(async () => {
  if (!token) return;
  await db
    .delete(apiDestructiveChallenges)
    .where(eq(apiDestructiveChallenges.tokenId, token.id));
  await db
    .delete(apiIdempotencyKeys)
    .where(eq(apiIdempotencyKeys.tokenId, token.id));
  await db.delete(apiTokens).where(eq(apiTokens.id, token.id));
});

describe("destructive challenge binding", () => {
  it("binds token, actor, operation, target, payload and consumes exactly once", async () => {
    const payload = { entity: "job", id: 42, mode: "permanent" };
    const created = await createDestructiveChallenge({
      token,
      operation: "permanent-delete",
      target: "job:42",
      payload,
    });
    const [stored] = await db
      .select()
      .from(apiDestructiveChallenges)
      .where(eq(apiDestructiveChallenges.tokenId, token.id));
    expect(stored.challengeHash).not.toBe(created.challenge);
    expect(stored.actorId).toBe(token.createdById);
    expect(stored.payloadHash).toBe(payloadHash(payload));

    await expect(
      withDestructiveChallenge(
        {
          token,
          challenge: created.challenge,
          operation: "permanent-delete",
          target: "job:99",
          payload,
        },
        async () => "unexpected"
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const result = await withDestructiveChallenge(
      {
        token,
        challenge: created.challenge,
        operation: "permanent-delete",
        target: "job:42",
        payload,
      },
      async (tx) => {
        const [row] = await tx
          .insert(auditLog)
          .values({
            entity: "job",
            entityId: 42,
            action: "phase4_challenge_test",
            userId: token.createdById,
          })
          .returning({ id: auditLog.id });
        return row.id;
      }
    );
    expect(result).toBeGreaterThan(0);
    await db.delete(auditLog).where(eq(auditLog.id, result));

    await expect(
      withDestructiveChallenge(
        {
          token,
          challenge: created.challenge,
          operation: "permanent-delete",
          target: "job:42",
          payload,
        },
        async () => "unexpected"
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects expiry and rolls challenge consumption back with a failed mutation", async () => {
    const expired = await createDestructiveChallenge({
      token,
      operation: "restore",
      target: "sheet:10",
      payload: { id: 10 },
      ttlMs: -1,
    });
    await expect(
      withDestructiveChallenge(
        {
          token,
          challenge: expired.challenge,
          operation: "restore",
          target: "sheet:10",
          payload: { id: 10 },
        },
        async () => true
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const rollback = await createDestructiveChallenge({
      token,
      operation: "restore",
      target: "sheet:11",
      payload: { id: 11 },
    });
    await expect(
      withDestructiveChallenge(
        {
          token,
          challenge: rollback.challenge,
          operation: "restore",
          target: "sheet:11",
          payload: { id: 11 },
        },
        async () => {
          throw new Error("target mutation failed");
        }
      )
    ).rejects.toThrow("target mutation failed");
    await expect(
      withDestructiveChallenge(
        {
          token,
          challenge: rollback.challenge,
          operation: "restore",
          target: "sheet:11",
          payload: { id: 11 },
        },
        async () => "retried"
      )
    ).resolves.toBe("retried");
  });
});

describe("persistent idempotency", () => {
  it("replays the original result and conflicts on payload mismatch without a second write", async () => {
    let writes = 0;
    const key = `phase4-${Date.now()}`;
    const execute = () =>
      executeIdempotent(
        {
          tokenId: token.id,
          key,
          operation: "create-pursuit",
          payload: { name: "Alpha", region: "Central" },
        },
        async () => {
          writes += 1;
          return { status: 201, body: { id: 700, writes } };
        }
      );
    expect(await execute()).toEqual({
      status: 201,
      body: { id: 700, writes: 1 },
      replayed: false,
    });
    expect(await execute()).toEqual({
      status: 201,
      body: { id: 700, writes: 1 },
      replayed: true,
    });
    expect(writes).toBe(1);

    await expect(
      executeIdempotent(
        {
          tokenId: token.id,
          key,
          operation: "create-pursuit",
          payload: { name: "Beta", region: "Central" },
        },
        async () => {
          writes += 1;
          return { status: 201, body: { id: 701 } };
        }
      )
    ).rejects.toBeInstanceOf(DomainError);
    expect(writes).toBe(1);
    const [record] = await db
      .select()
      .from(apiIdempotencyKeys)
      .where(
        and(
          eq(apiIdempotencyKeys.tokenId, token.id),
          eq(apiIdempotencyKeys.key, key)
        )
      );
    expect(record.responseBody).toEqual({ id: 700, writes: 1 });
  });
});
