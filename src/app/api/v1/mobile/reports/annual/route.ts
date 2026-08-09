import { buildAnnualReport } from "@/lib/annual-report";
import { jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import { getRoundsWithJobs } from "@/lib/queries";
import { getWorkspace } from "@/lib/workspace-server";

export async function GET(req: Request) {
  return withMobileAuth(req, async () => {
    try {
      const workspace = await getWorkspace();
      const year = Number(new URL(req.url).searchParams.get("year") ?? new Date().getFullYear());
      const rows = await getRoundsWithJobs(workspace);
      const data = buildAnnualReport({
        rows,
        region: workspace.region,
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
