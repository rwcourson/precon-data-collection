import { jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { listSheets } from "@/lib/sheets-server";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: ["read:pursuits", "read:sheets"] }, async (principal) => {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
    if (!q) {
      return jsonOk({ data: [], empty: true, message: "Enter a search term" });
    }
    const [rounds, sheets] = await Promise.all([
      listRoundsWithJobsForPrincipal(principal.authorization),
      listSheets(principal.authorization),
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
