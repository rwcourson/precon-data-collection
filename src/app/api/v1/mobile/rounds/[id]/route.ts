import {
  approveAndLock,
  savePostBidData,
  setOutcome,
  updateRoundCell,
} from "@/actions/post-bid";
import { DomainError } from "@/domain/errors";
import { FIELD_DEFS } from "@/lib/fields";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import {
  getCustomValuesForRounds,
  getMultiValues,
  getReferenceValues,
  getRoundWithJob,
} from "@/lib/queries";
import { missingRequiredFields } from "@/lib/validation";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
    const { id } = await ctx.params;
    const roundId = Number(id);
    if (!Number.isFinite(roundId)) return jsonError("Invalid round id", 400);

    const row = await getRoundWithJob(roundId);
    if (!row) return jsonError("Round not found", 404);

    const [multi, customMap, lists] = await Promise.all([
      getMultiValues(roundId),
      getCustomValuesForRounds([roundId]),
      getReferenceValues(),
    ]);
    const custom = customMap.get(roundId) ?? {};
    const multiForMissing = multi;
    const missing = missingRequiredFields(row.round, multiForMissing, {
      jobNumber: row.job.jobNumber,
      jobName: row.job.jobName,
      estimateLeadName: row.estimateLeadName,
    });

    return jsonOk({
      data: {
        round: row.round,
        job: row.job,
        estimateLeadName: row.estimateLeadName,
        multiValues: multi,
        customValues: custom,
        fieldDefs: FIELD_DEFS,
        referenceLists: lists,
        missingRequired: missing,
      },
    });
  });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
    const { id } = await ctx.params;
    const roundId = Number(id);
    if (!Number.isFinite(roundId)) return jsonError("Invalid round id", 400);
    let body: {
      values?: Record<string, string>;
      multiValues?: Record<string, string[]>;
      customValues?: Record<string, string>;
      estimateLeadId?: number | null;
      cell?: { key: string; value: string };
    };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    try {
      if (body.cell) {
        await updateRoundCell(roundId, body.cell.key, body.cell.value);
        return jsonOk({ ok: true, mode: "cell" });
      }
      const customValues: Record<number, string> = {};
      for (const [k, v] of Object.entries(body.customValues ?? {})) {
        customValues[Number(k)] = v;
      }
      await savePostBidData({
        roundId,
        values: body.values ?? {},
        multiValues: body.multiValues ?? {},
        customValues,
        estimateLeadId: body.estimateLeadId,
      });
      return jsonOk({ ok: true, mode: "save" });
    } catch (err) {
      return mapError(err);
    }
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
    const { id } = await ctx.params;
    const roundId = Number(id);
    if (!Number.isFinite(roundId)) return jsonError("Invalid round id", 400);
    const url = new URL(req.url);
    // action via ?action= or path suffix handled by sibling routes
    const action = url.searchParams.get("action");
    if (action === "approve-lock") {
      try {
        await approveAndLock(roundId);
        return jsonOk({ ok: true, locked: true });
      } catch (err) {
        if (err instanceof DomainError) {
          const row = await getRoundWithJob(roundId);
          let missing: string[] = [];
          if (row) {
            const m = await getMultiValues(roundId);
            missing = missingRequiredFields(row.round, m, {
              jobNumber: row.job.jobNumber,
              jobName: row.job.jobName,
              estimateLeadName: row.estimateLeadName,
            });
          }
          return jsonError(err.what, 400, {
            code: err.code,
            why: err.why,
            solution: err.solution,
            missingFields: missing,
            details: missing,
          });
        }
        // approveAndLock may throw plain Error with missing fields
        const msg = err instanceof Error ? err.message : "Lock failed";
        const row = await getRoundWithJob(roundId);
        let missing: string[] = [];
        if (row) {
          const m = await getMultiValues(roundId);
          missing = missingRequiredFields(row.round, m, {
            jobNumber: row.job.jobNumber,
            jobName: row.job.jobName,
            estimateLeadName: row.estimateLeadName,
          });
        }
        if (missing.length > 0 || /missing|required|incomplete/i.test(msg)) {
          return jsonError(msg, 400, {
            code: "BAD_REQUEST",
            missingFields: missing,
            details: missing,
          });
        }
        return mapError(err);
      }
    }
    if (action === "outcome") {
      let body: { outcome?: string };
      try {
        body = await req.json();
      } catch {
        return jsonError("Invalid JSON", 400);
      }
      try {
        await setOutcome(
          roundId,
          body.outcome as Parameters<typeof setOutcome>[1],
        );
        return jsonOk({ ok: true, outcome: body.outcome });
      } catch (err) {
        return mapError(err);
      }
    }
    return jsonError("Unknown action — use approve-lock or outcome", 400);
  });
}
