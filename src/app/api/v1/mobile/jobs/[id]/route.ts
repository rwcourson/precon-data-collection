import { eq } from "drizzle-orm";
import { db } from "@/db";
import { estimateRounds, jobs } from "@/db/schema";
import { jsonError, jsonOk, withMobileAuth } from "@/lib/mobile-http";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
    const { id } = await ctx.params;
    const jobId = Number(id);
    if (!Number.isFinite(jobId)) return jsonError("Invalid job id", 400);

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job || job.deletedAt) return jsonError("Job not found", 404);

    const rounds = await db
      .select()
      .from(estimateRounds)
      .where(
        eq(estimateRounds.jobId, jobId),
      );

    return jsonOk({
      data: {
        job,
        rounds: rounds.filter((r) => r.deletedAt == null),
      },
    });
  });
}
