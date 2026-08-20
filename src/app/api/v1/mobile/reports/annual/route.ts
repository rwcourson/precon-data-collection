import { buildAnnualReport } from "@/lib/annual-report";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import { maskRoundRowsForMetrics } from "@/services/field-exceptions-service";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "read:reports" }, async (principal) => {
    try {
      const year = Number(
        new URL(req.url).searchParams.get("year") ?? new Date().getFullYear()
      );
      const listed = await listRoundsWithJobsForPrincipal(
        principal.authorization
      );
      const rows = await maskRoundRowsForMetrics(listed);
      const data = buildAnnualReport({
        rows,
        region: principal.authorization.workspace.region,
        fromYear: year - 2,
        toYear: year,
      });
      const hasYears = Array.isArray(data.years) && data.years.length > 0;
      return jsonOk({
        data,
        empty: !hasYears,
        emptyLabel: hasYears ? undefined : "No annual report data",
      });
    } catch (err) {
      return mapError(err);
    }
  });
}
