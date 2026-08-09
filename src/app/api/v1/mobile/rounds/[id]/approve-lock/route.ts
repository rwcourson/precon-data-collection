import { approveAndLock } from "@/actions/post-bid";
import { DomainError } from "@/domain/errors";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import { getMultiValues, getRoundWithJob } from "@/lib/queries";
import { missingRequiredFields } from "@/lib/validation";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
    const { id } = await ctx.params;
    const roundId = Number(id);
    if (!Number.isFinite(roundId)) return jsonError("Invalid round id", 400);
    try {
      await approveAndLock(roundId);
      return jsonOk({ ok: true, locked: true, roundId });
    } catch (err) {
      const row = await getRoundWithJob(roundId);
      let missing: string[] = [];
      if (row) {
        const multi = await getMultiValues(roundId);
        missing = missingRequiredFields(row.round, multi, {
          jobNumber: row.job.jobNumber,
          jobName: row.job.jobName,
          estimateLeadName: row.estimateLeadName,
        });
      }
      if (err instanceof DomainError) {
        return jsonError(err.what, 400, {
          code: err.code,
          why: err.why,
          solution: err.solution,
          missingFields: missing,
          details: missing,
        });
      }
      const msg = err instanceof Error ? err.message : "Lock failed";
      if (missing.length > 0 || /missing|required|incomplete|cannot/i.test(msg)) {
        return jsonError(msg, 400, {
          code: "BAD_REQUEST",
          missingFields: missing,
          details: missing,
        });
      }
      return mapError(err);
    }
  });
}
