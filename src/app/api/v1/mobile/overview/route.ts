import { jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { STATUS_ORDER } from "@/lib/permissions";
import { fmtDollars } from "@/lib/format";
import type { RoundStatus } from "@/db/schema";

const BID_YEAR = 2026;

/**
 * Mobile home KPIs — same semantics as web `src/app/page.tsx`.
 */
export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "read:pursuits" }, async (principal) => {
    const regionRows = await listRoundsWithJobsForPrincipal(principal.authorization);

    const byStatus: Record<string, number> = {};
    for (const s of STATUS_ORDER) byStatus[s] = 0;
    for (const r of regionRows) {
      const st = r.round.status as RoundStatus;
      byStatus[st] = (byStatus[st] ?? 0) + 1;
    }

    const ytd = regionRows.filter((r) => r.round.bidYear === BID_YEAR);
    const ytdVolume = ytd.reduce((sum, r) => sum + (r.round.estimateValue ?? 0), 0);
    const awaitingPostBid = regionRows.filter((r) =>
      ["submitted", "post_bid"].includes(r.round.status),
    );
    const awaitingApproval = regionRows.filter((r) => r.round.status === "post_bid");
    const lockedYtd = ytd.filter((r) => r.round.status === "locked");
    const wins = lockedYtd.filter((r) => r.round.outcome === "successful").length;
    const decided = lockedYtd.filter((r) => r.round.outcome !== "pending").length;
    const winRatePct = decided > 0 ? Math.round((wins / decided) * 100) : null;

    return jsonOk({
      workspace: {
        region: principal.authorization.workspace.region,
        label: principal.authorization.workspace.region ?? "Corporate",
      },
      bidYear: BID_YEAR,
      kpis: {
        ytdVolume,
        ytdVolumeLabel: fmtDollars(ytdVolume, true),
        ytdRoundCount: ytd.length,
        awaitingPostBid: awaitingPostBid.length,
        awaitingApproval: awaitingApproval.length,
        winRatePct,
        wins,
        decided,
      },
      byStatus,
      totalRounds: regionRows.length,
    });
  });
}
