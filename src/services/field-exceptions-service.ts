import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  type EstimateRound,
  estimateRounds,
  roundFieldExceptions,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadRoundForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import { FIELD_MAP, fieldAllowsNa, fieldRangeIssue } from "@/lib/fields";
import { roundForMetrics } from "@/lib/metrics";
import { withTransaction } from "@/lib/transactions";
import {
  applicableExceptionKeys,
  type FieldExceptionState,
  snapshotForException,
} from "@/lib/validation";

type SnapshotMap = Map<string, string | null>;

type MutableExceptions = {
  notApplicable: SnapshotMap;
  rangeAcknowledged: SnapshotMap;
};

async function currentRoundValues(
  roundIds: number[]
): Promise<Map<number, Record<string, unknown>>> {
  const out = new Map<number, Record<string, unknown>>();
  if (roundIds.length === 0) return out;
  const rows = await db
    .select()
    .from(estimateRounds)
    .where(inArray(estimateRounds.id, roundIds));
  for (const row of rows) {
    out.set(row.id, row as unknown as Record<string, unknown>);
  }
  return out;
}

function stateForValues(
  snapshots: MutableExceptions,
  values: Record<string, unknown>
): FieldExceptionState {
  return {
    notApplicable: applicableExceptionKeys(snapshots.notApplicable, values),
    rangeAcknowledged: applicableExceptionKeys(
      snapshots.rangeAcknowledged,
      values
    ),
  };
}

export async function loadFieldExceptions(
  roundId: number
): Promise<FieldExceptionState> {
  const [byRound, values] = await Promise.all([
    loadExceptionSnapshotsByRound([roundId]),
    currentRoundValues([roundId]),
  ]);
  const snapshots = byRound.get(roundId) ?? {
    notApplicable: new Map(),
    rangeAcknowledged: new Map(),
  };
  return stateForValues(snapshots, values.get(roundId) ?? {});
}

export async function loadNotApplicableKeysByRound(
  roundIds: number[]
): Promise<Map<number, Set<string>>> {
  const [byRound, values] = await Promise.all([
    loadExceptionSnapshotsByRound(roundIds),
    currentRoundValues(roundIds),
  ]);
  return new Map(
    [...byRound.entries()].map(([id, snapshots]) => [
      id,
      applicableExceptionKeys(snapshots.notApplicable, values.get(id) ?? {}),
    ])
  );
}

export async function maskRoundsForMetrics(
  rounds: EstimateRound[]
): Promise<EstimateRound[]> {
  const na = await loadNotApplicableKeysByRound(
    rounds.map((round) => round.id)
  );
  return rounds.map((round) => roundForMetrics(round, na.get(round.id)));
}

export async function maskRoundRowsForMetrics<
  T extends { round: EstimateRound },
>(rows: T[]): Promise<T[]> {
  const masked = await maskRoundsForMetrics(rows.map((row) => row.round));
  return rows.map((row, index) => ({ ...row, round: masked[index]! }));
}

async function loadExceptionSnapshotsByRound(
  roundIds: number[]
): Promise<Map<number, MutableExceptions>> {
  const out = new Map<number, MutableExceptions>();
  if (roundIds.length === 0) return out;
  const rows = await db
    .select()
    .from(roundFieldExceptions)
    .where(
      and(
        inArray(roundFieldExceptions.roundId, roundIds),
        isNull(roundFieldExceptions.revokedAt)
      )
    );
  for (const row of rows) {
    const current = out.get(row.roundId) ?? {
      notApplicable: new Map<string, string | null>(),
      rangeAcknowledged: new Map<string, string | null>(),
    };
    if (row.kind === "not_applicable") {
      current.notApplicable.set(row.fieldKey, row.valueSnapshot);
    }
    if (row.kind === "range_acknowledgement") {
      current.rangeAcknowledged.set(row.fieldKey, row.valueSnapshot);
    }
    out.set(row.roundId, current);
  }
  return out;
}

export async function setFieldException(
  principal: Principal,
  input: {
    roundId: number;
    fieldKey: string;
    kind: "not_applicable" | "range_acknowledgement";
    enabled: boolean;
    reason?: string;
  }
) {
  const loaded = await loadRoundForPrincipal(principal, input.roundId, {
    capability: "edit",
    fieldKey: input.fieldKey,
  });
  if (!loaded) throw DomainError.notFound("Round not found");
  const def = FIELD_MAP[input.fieldKey];
  if (!def) throw DomainError.badRequest("Unknown field");
  const value = (loaded.value.round as unknown as Record<string, unknown>)[
    input.fieldKey
  ];
  if (input.kind === "not_applicable" && !fieldAllowsNa(def)) {
    throw DomainError.badRequest(`${def.label} cannot be marked N/A`);
  }
  if (input.kind === "range_acknowledgement" && !fieldRangeIssue(def, value)) {
    throw DomainError.badRequest(`${def.label} is not outside its usual range`);
  }

  await withTransaction(async (tx) => {
    await tx
      .update(roundFieldExceptions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(roundFieldExceptions.roundId, input.roundId),
          eq(roundFieldExceptions.fieldKey, input.fieldKey),
          eq(roundFieldExceptions.kind, input.kind),
          isNull(roundFieldExceptions.revokedAt)
        )
      );
    if (input.enabled) {
      await tx.insert(roundFieldExceptions).values({
        roundId: input.roundId,
        fieldKey: input.fieldKey,
        kind: input.kind,
        valueSnapshot: snapshotForException(value),
        reason: input.reason?.trim() || null,
        electedById: principal.user.id,
      });
    }
    await tx.insert(auditLog).values({
      entity: "round",
      entityId: input.roundId,
      roundId: input.roundId,
      action: input.enabled
        ? "field_exception_elected"
        : "field_exception_revoked",
      field: input.fieldKey,
      oldValue: input.enabled ? null : input.kind,
      newValue: input.enabled ? input.kind : null,
      userId: principal.user.id,
    });
  });
}
