import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { MAX_PAGE_SIZE, parsePagination } from "@/lib/pagination";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "read:pursuits" }, async (principal) => {
    // Existing consumers (Magnus/agent tokens, docs/magnus-api.md) expect the
    // `{ data, count }` array shape and previously received every round, so
    // the default limit is the maximum page size rather than DEFAULT_PAGE_SIZE.
    // `count` remains the number of items in `data`; use `nextOffset` to page.
    const { limit, offset } = parsePagination(new URL(req.url).searchParams, {
      limit: MAX_PAGE_SIZE,
    });
    // One extra row tells us whether another page exists without a count query.
    const rows = await listRoundsWithJobsForPrincipal(principal.authorization, {
      limit: limit + 1,
      offset,
    });
    const data = rows.slice(0, limit).map(({ job, round }) => ({
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
    return jsonOk({
      data,
      count: data.length,
      limit,
      offset,
      nextOffset: rows.length > limit ? offset + limit : null,
    });
  });
}
