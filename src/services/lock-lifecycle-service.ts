import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  auditLog,
  publicationOutbox,
  roundLockRevisions,
  statusTransitions,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadRoundForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import { updateRoundIfUnchanged, withTransaction } from "@/lib/transactions";
import { recordProductEvent } from "@/services/product-events-service";

export async function unlockRound(
  principal: Principal,
  roundId: number,
  reason: string
) {
  if (!["rpd", "corporate_admin"].includes(principal.user.role)) {
    throw DomainError.forbidden("Only an RPD or corporate admin can unlock.");
  }
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3) {
    throw DomainError.badRequest(
      "Explain why the locked record is being sent back."
    );
  }
  const loaded = await loadRoundForPrincipal(principal, roundId);
  if (!loaded) throw DomainError.notFound("Round not found");
  const round = loaded.value.round;
  if (round.status !== "locked") {
    throw DomainError.badRequest("Only a locked record can be sent back.");
  }

  const result = await withTransaction(async (tx) => {
    const [revision] = await tx
      .select()
      .from(roundLockRevisions)
      .where(
        and(
          eq(roundLockRevisions.roundId, roundId),
          isNull(roundLockRevisions.unlockedAt)
        )
      )
      .orderBy(desc(roundLockRevisions.revision))
      .limit(1);
    if (!revision) {
      await updateRoundIfUnchanged(tx, {
        roundId,
        expectedStatus: "locked",
        expectedUpdatedAt: round.updatedAt,
        patch: { status: "post_bid", lockedAt: null },
      });
      await tx.insert(statusTransitions).values({
        roundId,
        fromStatus: "locked",
        toStatus: "post_bid",
        userId: principal.user.id,
        reason: trimmedReason,
        metadata: { action: "unlock", legacyUnlock: true },
      });
      await tx.insert(auditLog).values({
        entity: "round",
        entityId: roundId,
        roundId,
        action: "round_unlocked",
        field: "status",
        oldValue: "locked",
        newValue: "post_bid",
        userId: principal.user.id,
      });
      await tx
        .insert(publicationOutbox)
        .values({
          destination: "databricks",
          eventType: "retract",
          roundId,
          lockRevisionId: null,
          idempotencyKey: `databricks:${roundId}:1:retract`,
          payload: {
            roundId,
            revision: 1,
            unlockedAt: new Date().toISOString(),
            reason: trimmedReason,
            legacyUnlock: true,
          },
        })
        .onConflictDoNothing({
          target: publicationOutbox.idempotencyKey,
        });
      return { revision: null };
    }
    const unlockedAt = new Date();
    await updateRoundIfUnchanged(tx, {
      roundId,
      expectedStatus: "locked",
      expectedUpdatedAt: round.updatedAt,
      patch: { status: "post_bid", lockedAt: null },
    });
    await tx
      .update(roundLockRevisions)
      .set({
        unlockedById: principal.user.id,
        unlockedAt,
        unlockReason: trimmedReason,
      })
      .where(eq(roundLockRevisions.id, revision.id));
    await tx.insert(statusTransitions).values({
      roundId,
      fromStatus: "locked",
      toStatus: "post_bid",
      userId: principal.user.id,
      reason: trimmedReason,
      metadata: { lockRevision: revision.revision, action: "unlock" },
    });
    await tx.insert(auditLog).values({
      entity: "round",
      entityId: roundId,
      roundId,
      action: "round_unlocked",
      field: "status",
      oldValue: "locked",
      newValue: "post_bid",
      userId: principal.user.id,
    });
    await tx
      .insert(publicationOutbox)
      .values({
        destination: "databricks",
        eventType: "retract",
        roundId,
        lockRevisionId: revision.id,
        idempotencyKey: `databricks:${roundId}:${revision.revision}:retract`,
        payload: {
          roundId,
          revision: revision.revision,
          unlockedAt: unlockedAt.toISOString(),
          reason: trimmedReason,
        },
      })
      .onConflictDoNothing({
        target: publicationOutbox.idempotencyKey,
      });
    return { revision: revision.revision };
  });
  await recordProductEvent(principal, "lock.unlocked", {
    roundId,
    revision: result.revision,
  });
  return result;
}
