import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { jsonOk, withMobileAuth } from "@/lib/mobile-http";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "read:pursuits" }, async (principal) => {
    const rows = await listRoundsWithJobsForPrincipal(principal.authorization);
    const data = rows.map(({ job, round }) => ({
      jobId: job.id,
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      region: job.region,
      roundId: round.id,
      status: round.status,
      estimatePhase: round.estimatePhase,
      estimateValue: round.estimateValue,
      outcome: round.outcome,
    }));
    return jsonOk({ data, count: data.length });
  });
}
