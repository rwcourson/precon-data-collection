import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { estimateRounds } from "@/db/schema";
import { jsonError, jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { authorizationService } from "@/services/authorization-service";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return withMobileAuth(req, { scopes: "read:pursuits" }, async (principal) => {
    const { id } = await ctx.params;
    const jobId = Number(id);
    if (!Number.isFinite(jobId)) return jsonError("Invalid job id", 400);

    const result = await authorizationService.readJob(
      principal.authorization,
      jobId
    );
    if (!result.ok)
      return jsonError(result.error.what, 404, { code: result.error.code });
    const job = result.value;

    const rounds = await db
      .select()
      .from(estimateRounds)
      .where(
        and(eq(estimateRounds.jobId, jobId), isNull(estimateRounds.deletedAt))
      );

    return jsonOk({
      data: {
        job,
        rounds,
      },
    });
  });
}
