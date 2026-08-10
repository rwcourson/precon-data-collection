import { buildForecastSeries, resolveForecastTimingDate } from "@/lib/forecast";
import { jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "read:dashboards" }, async (principal) => {
    const rows = await listRoundsWithJobsForPrincipal(principal.authorization);
    const inputs = rows.map((r) => ({
      id: r.round.id,
      jobId: r.job.id,
      jobNumber: r.job.jobNumber,
      jobName: r.job.jobName,
      estimateValue: r.round.estimateValue,
      timingDate: resolveForecastTimingDate({
        projectStartDate: r.round.projectStartDate,
        bidDueDate: r.round.bidDueDate,
      }),
      outcome: r.round.outcome as "pending" | "successful" | "unsuccessful",
      region: r.round.region,
    }));
    const series = buildForecastSeries(inputs);
    const empty = !series.months || series.months.length === 0;
    return jsonOk({
      series,
      empty,
      emptyLabel: "No forecast points yet",
    });
  });
}
