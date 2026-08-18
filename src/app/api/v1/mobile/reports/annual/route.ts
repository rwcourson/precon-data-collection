import { buildAnnualReport } from "@/lib/annual-report";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "read:reports" }, async (principal) => {
    try {
      const year = Number(
        new URL(req.url).searchParams.get("year") ?? new Date().getFullYear()
      );
      const rows = await listRoundsWithJobsForPrincipal(
        principal.authorization
      );
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
