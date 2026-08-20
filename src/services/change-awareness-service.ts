import "server-only";
import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, userRoundWatermarks } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadRoundForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import {
  type RoundChangeSummary,
  summarizeChangesSinceWatermarks,
} from "@/lib/change-watermarks";
import { recordProductEvent } from "@/services/product-events-service";

export type { RoundChangeSummary };

export async function loadRoundChanges(
  principal: Principal,
  roundIds: number[]
): Promise<Map<number, RoundChangeSummary>> {
  if (!roundIds.length) return new Map();
  const watermarks = await db
    .select()
    .from(userRoundWatermarks)
    .where(
      and(
        eq(userRoundWatermarks.userId, principal.user.id),
        inArray(userRoundWatermarks.roundId, roundIds)
      )
    );
  const watermarkByRound = new Map(
    watermarks.map((watermark) => [
      watermark.roundId,
      watermark.lastAckedAuditId ?? 0,
    ])
  );
  const recentCutoff = new Date(Date.now() - 14 * 86_400_000);
  const changes = await db
    .select()
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.roundId, roundIds),
        ne(auditLog.userId, principal.user.id),
        gt(auditLog.createdAt, recentCutoff)
      )
    )
    .orderBy(desc(auditLog.id));
  const out = summarizeChangesSinceWatermarks(
    changes,
    principal.user.id,
    watermarkByRound
  );
  return out;
}

export async function acknowledgeRoundChanges(
  principal: Principal,
  roundId: number,
  throughAuditId: number
) {
  const loaded = await loadRoundForPrincipal(principal, roundId);
  if (!loaded) throw DomainError.notFound("Round not found");
  const now = new Date();
  await db
    .insert(userRoundWatermarks)
    .values({
      userId: principal.user.id,
      roundId,
      lastSeenAt: now,
      lastAckedAuditId: throughAuditId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userRoundWatermarks.userId, userRoundWatermarks.roundId],
      set: {
        lastSeenAt: now,
        lastAckedAuditId: throughAuditId,
        updatedAt: now,
      },
    });
  await recordProductEvent(principal, "change.acknowledged", {
    roundId,
    throughAuditId,
  });
}

export async function acknowledgeVisibleChanges(
  principal: Principal,
  items: { roundId: number; throughAuditId: number }[]
) {
  for (const item of items) {
    await acknowledgeRoundChanges(principal, item.roundId, item.throughAuditId);
  }
}
