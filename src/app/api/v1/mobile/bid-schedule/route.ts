import {
  LIFECYCLE_SECTION_ORDER,
  parseBidScheduleGroupBy,
  type LifecycleSectionKey,
} from "@/lib/bid-schedule";
import { jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { getRoundsWithJobs } from "@/lib/queries";
import { getWorkspace } from "@/lib/workspace-server";

export async function GET(req: Request) {
  return withMobileAuth(req, async () => {
    const url = new URL(req.url);
    const section = (url.searchParams.get("section") ?? "all").toLowerCase();
    const groupBy = parseBidScheduleGroupBy(url.searchParams.get("groupBy") ?? "none");
    const workspace = await getWorkspace();
    const rows = await getRoundsWithJobs(workspace);

    const lifecycle = new Set<string>(LIFECYCLE_SECTION_ORDER);
    let filtered = rows;
    if (section !== "all" && lifecycle.has(section)) {
      filtered = rows.filter((r) => r.round.status === section);
    }

    const data = filtered.map((r) => ({
      roundId: r.round.id,
      jobId: r.job.id,
      jobNumber: r.job.jobNumber,
      jobName: r.job.jobName,
      status: r.round.status,
      outcome: r.round.outcome,
      region: r.round.region,
      preconDepartment: r.round.preconDepartment,
      marketSector: r.round.marketSector,
      estimatePhase: r.round.estimatePhase,
      bidDueDate: r.round.bidDueDate,
      estimateValue: r.round.estimateValue,
      roundNumber: r.round.roundNumber,
      estimateLeadName: r.estimateLeadName,
      groupKey:
        groupBy === "none"
          ? null
          : groupBy === "preconDepartment"
            ? r.round.preconDepartment
            : groupBy === "marketSector"
              ? r.round.marketSector
              : groupBy === "estimatePhase"
                ? r.round.estimatePhase
                : r.round.bidDueDate,
    }));

    const sections = LIFECYCLE_SECTION_ORDER.map((key: LifecycleSectionKey) => ({
      key,
      count: rows.filter((r) => r.round.status === key).length,
    }));

    return jsonOk({
      data,
      count: data.length,
      section,
      groupBy,
      sections,
    });
  });
}
