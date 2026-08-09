import { jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { getRoundsWithJobs } from "@/lib/queries";
import { listSheets } from "@/lib/sheets-server";
import { getCurrentUser } from "@/lib/current-user";
import { getWorkspace } from "@/lib/workspace-server";

export async function GET(req: Request) {
  return withMobileAuth(req, async () => {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
    if (!q) {
      return jsonOk({ data: [], empty: true, message: "Enter a search term" });
    }
    const workspace = await getWorkspace();
    const user = await getCurrentUser();
    const [rounds, sheets] = await Promise.all([
      getRoundsWithJobs(workspace),
      listSheets(workspace, user),
    ]);

    const jobHits = rounds
      .filter(
        (r) =>
          r.job.jobName.toLowerCase().includes(q) ||
          r.job.jobNumber.toLowerCase().includes(q),
      )
      .slice(0, 20)
      .map((r) => ({
        type: "job" as const,
        id: r.job.id,
        roundId: r.round.id,
        title: r.job.jobName,
        subtitle: r.job.jobNumber,
      }));

    const sheetHits = sheets
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map((s) => ({
        type: "sheet" as const,
        id: s.id,
        title: s.name,
        subtitle: s.folder,
      }));

    return jsonOk({ data: [...jobHits, ...sheetHits], empty: false });
  });
}
