import "server-only";
import { and, asc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import {
  appSettings,
  publicationOutbox,
  roundLockRevisions,
} from "@/db/schema";
import { calcMetric, METRIC_DEFS } from "@/lib/metrics";
import {
  getAllCustomColumns,
  getCustomValuesForRounds,
  getMultiValuesForRounds,
  getRoundsWithJobs,
} from "@/lib/queries";
import { loadNotApplicableKeysByRound } from "@/services/field-exceptions-service";
import { recordProductEvent } from "@/services/product-events-service";
import { warehousePublicationEnabled } from "@/services/rollout-service";
import { databricksConfig, runStatement } from "./client";
import {
  mergeOnRoundAndRevisionSql,
  publicationRevisionFromPayload,
  retractLockedRevisionSql,
  warehouseProductEventName,
} from "./publication-sql";
import { databricksWritesAllowed } from "./read";

/**
 * Outbound feed of current locked revisions to the warehouse, so
 * Power BI reads Precon data from the same place as everything else at B&G.
 *
 * The payload is deliberately one wide row per estimate round — the shape the
 * Estimate Summary sheets already have — with the two-tier custom columns
 * carried as a JSON map so a Region adding a column never requires a schema
 * change on the warehouse side.
 *
 * Writes are OFF by default. Set DATABRICKS_ALLOW_WRITE=true only after shadow
 * reconciliation. Publication is idempotent and never truncates the target.
 */

export const FEED_STATE_KEY = "databricksFeed";

export type FeedState = {
  lastRunAt: string | null;
  lastRowCount: number;
  lastStatus: "never" | "preview" | "pushed" | "failed";
  lastError: string | null;
};

export const DEFAULT_FEED_STATE: FeedState = {
  lastRunAt: null,
  lastRowCount: 0,
  lastStatus: "never",
  lastError: null,
};

export async function getFeedState(): Promise<FeedState> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, FEED_STATE_KEY));
  if (!row) return DEFAULT_FEED_STATE;
  return { ...DEFAULT_FEED_STATE, ...(row.value as Partial<FeedState>) };
}

async function setFeedState(next: FeedState) {
  await db
    .insert(appSettings)
    .values({ key: FEED_STATE_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
}

export type FeedRow = Record<string, string | number | boolean | null>;

/** Builds the full outbound row set. Read-only — safe to call for a preview. */
export async function buildFeedRows(): Promise<FeedRow[]> {
  const [allRounds, customCols] = await Promise.all([
    getRoundsWithJobs(),
    getAllCustomColumns(),
  ]);
  const rounds = allRounds.filter((item) => item.round.status === "locked");
  const ids = rounds.map((r) => r.round.id);
  const [multiMap, customMap, naMap] = await Promise.all([
    getMultiValuesForRounds(ids),
    getCustomValuesForRounds(ids),
    loadNotApplicableKeysByRound(ids),
  ]);
  const revisions =
    ids.length > 0
      ? await db
          .select({
            id: roundLockRevisions.id,
            roundId: roundLockRevisions.roundId,
            revision: roundLockRevisions.revision,
          })
          .from(roundLockRevisions)
          .where(
            and(
              inArray(roundLockRevisions.roundId, ids),
              isNull(roundLockRevisions.unlockedAt)
            )
          )
      : [];
  const revisionByRound = new Map(
    revisions.map((revision) => [revision.roundId, revision])
  );
  const colById = new Map(customCols.map((c) => [c.id, c]));

  return rounds.map(({ round, job, estimateLeadName }) => {
    const multi = multiMap.get(round.id) ?? {};
    const custom: Record<string, string | null> = {};
    for (const [colId, value] of Object.entries(
      customMap.get(round.id) ?? {}
    )) {
      const col = colById.get(Number(colId));
      if (col) custom[col.label] = value;
    }

    const row: FeedRow = {
      round_id: round.id,
      job_id: job.id,
      lock_revision: revisionByRound.get(round.id)?.revision ?? 1,
      job_number: job.jobNumber,
      job_name: job.jobName,
      salesforce_id: job.salesforceId,
      is_linked: job.isLinked,
      region: round.region,
      precon_department: round.preconDepartment,
      estimate_phase: round.estimatePhase,
      bid_year: round.bidYear,
      bid_due_date: round.bidDueDate,
      drawings_due_date: round.drawingsDueDate,
      bid_review_date: round.bidReviewDate,
      interview_date: round.interviewDate,
      project_start_month: round.projectStartMonth,
      status: round.status,
      outcome: round.outcome,
      market_sector: round.marketSector,
      contract_type: round.contractType,
      procurement: round.procurement,
      estimate_lead: estimateLeadName,
      estimate_value: round.estimateValue,
      awardable_amount: round.awardableAmount,
      contract_amount_signed: round.contractAmountSigned,
      fee_expected: round.feeExpected,
      contingency_total: round.contingencyTotal,
      submitted_at: round.submittedAt?.toISOString() ?? null,
      locked_at: round.lockedAt?.toISOString() ?? null,
      updated_at: round.updatedAt.toISOString(),
      self_perform_work_types:
        (multi.selfPerformWorkType ?? []).join("; ") || null,
      self_perform_intent: (multi.selfPerformIntent ?? []).join("; ") || null,
      utilized_support_services:
        (multi.utilizedSupportServices ?? []).join("; ") || null,
      custom_columns: JSON.stringify(custom),
    };

    for (const def of METRIC_DEFS) {
      const value = calcMetric(def, round, naMap.get(round.id));
      row[`metric_${toSnake(def.key)}`] =
        value == null || !Number.isFinite(value) ? null : value;
    }
    return row;
  });
}

const toSnake = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

export type FeedResult = {
  configured: boolean;
  rows: number;
  status: FeedState["lastStatus"];
  table?: string;
  error?: string;
  /** First rows of the payload, so an unconfigured run is still reviewable. */
  preview?: FeedRow[];
};

/** Processes versioned publication events, with a safe locked-only bootstrap. */
export async function runDatabricksFeed(
  opts: { previewOnly?: boolean } = {}
): Promise<FeedResult> {
  const rows = await buildFeedRows();
  const cfg = databricksConfig();
  const allowWrite =
    databricksWritesAllowed() && (await warehousePublicationEnabled());
  const pendingEvents = await db
    .select()
    .from(publicationOutbox)
    .where(
      and(
        eq(publicationOutbox.destination, "databricks"),
        or(
          eq(publicationOutbox.status, "queued"),
          and(
            eq(publicationOutbox.status, "failed"),
            lt(publicationOutbox.attemptCount, 5)
          )
        )
      )
    )
    .orderBy(asc(publicationOutbox.createdAt));

  if (!cfg || opts.previewOnly || !allowWrite) {
    const state: FeedState = {
      lastRunAt: new Date().toISOString(),
      lastRowCount: rows.length,
      lastStatus: "preview",
      lastError: !cfg
        ? "Databricks credentials are not configured."
        : !allowWrite
          ? "Warehouse writes disabled (DATABRICKS_ALLOW_WRITE≠true). Read-only mode."
          : null,
    };
    await setFeedState(state);
    return {
      configured: Boolean(cfg),
      rows: rows.length,
      status: "preview",
      table: cfg?.table,
      preview: rows.slice(0, 3),
      error:
        state.lastError ??
        (pendingEvents.length
          ? `${pendingEvents.length} publication event(s) waiting`
          : undefined),
    };
  }

  try {
    const columns = Object.keys(rows[0] ?? {});
    if (columns.length > 0) {
      await runStatement(
        cfg,
        `CREATE TABLE IF NOT EXISTS ${cfg.table} (${ddl(columns)})`
      );
    }
    if (pendingEvents.length === 0) {
      // Safe bootstrap/reconciliation: upsert current locked rows, never delete
      // records merely because an in-flight round is absent.
      await mergeRows(cfg, rows);
    } else {
      const byRound = new Map(rows.map((row) => [Number(row.round_id), row]));
      for (const event of pendingEvents) {
        try {
          if (event.eventType === "retract") {
            const revisionNumber = publicationRevisionFromPayload(
              event.payload as { revision?: number } | null
            );
            if (revisionNumber == null) {
              throw new Error(
                `Retract event ${event.id} is missing payload.revision.`
              );
            }
            await runStatement(
              cfg,
              retractLockedRevisionSql(cfg.table, event.roundId, revisionNumber)
            );
          } else {
            const row = byRound.get(event.roundId);
            if (!row) {
              throw new Error(
                `Locked row ${event.roundId} is not available for publication.`
              );
            }
            await mergeRows(cfg, [row]);
          }
          await db
            .update(publicationOutbox)
            .set({
              status: "processed",
              processedAt: new Date(),
              error: null,
            })
            .where(
              and(
                eq(publicationOutbox.id, event.id),
                eq(publicationOutbox.destination, "databricks")
              )
            );
          const warehouseEvent = warehouseProductEventName(event.eventType);
          if (warehouseEvent) {
            await recordProductEvent(null, warehouseEvent, {
              roundId: event.roundId,
              outboxId: event.id,
              eventType: event.eventType,
            });
          }
        } catch (error) {
          await db
            .update(publicationOutbox)
            .set({
              status: "failed",
              attemptCount: event.attemptCount + 1,
              error:
                error instanceof Error
                  ? error.message.slice(0, 2_000)
                  : "Publication failed",
            })
            .where(
              and(
                eq(publicationOutbox.id, event.id),
                eq(publicationOutbox.destination, "databricks")
              )
            );
          throw error;
        }
      }
    }

    const state: FeedState = {
      lastRunAt: new Date().toISOString(),
      lastRowCount: rows.length,
      lastStatus: "pushed",
      lastError: null,
    };
    await setFeedState(state);
    return {
      configured: true,
      rows: rows.length,
      status: "pushed",
      table: cfg.table,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await setFeedState({
      lastRunAt: new Date().toISOString(),
      lastRowCount: rows.length,
      lastStatus: "failed",
      lastError: message,
    });
    return {
      configured: true,
      rows: rows.length,
      status: "failed",
      table: cfg.table,
      error: message,
    };
  }
}

async function mergeRows(
  cfg: NonNullable<ReturnType<typeof databricksConfig>>,
  rows: FeedRow[]
) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]!);
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const source = chunk
      .map(
        (row) =>
          `SELECT ${columns
            .map((column) => `${sqlLiteral(row[column])} AS ${column}`)
            .join(", ")}`
      )
      .join(" UNION ALL ");
    await runStatement(
      cfg,
      mergeOnRoundAndRevisionSql(cfg.table, columns, source)
    );
  }
}

/** Everything lands as STRING or DOUBLE; the warehouse casts downstream. */
function ddl(columns: string[]): string {
  return columns
    .map(
      (c) =>
        `${c} ${c.startsWith("metric_") || NUMERIC.has(c) ? "DOUBLE" : "STRING"}`
    )
    .join(", ");
}

const NUMERIC = new Set([
  "round_id",
  "job_id",
  "lock_revision",
  "bid_year",
  "estimate_value",
  "awardable_amount",
  "contract_amount_signed",
  "fee_expected",
  "contingency_total",
]);

function sqlLiteral(v: string | number | boolean | null | undefined): string {
  if (v == null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "'true'" : "'false'";
  return `'${v.replace(/'/g, "''")}'`;
}
