"use client";

import dynamic from "next/dynamic";
import type { ScheduleModeJob } from "@/components/bid-schedule/schedule-modes";

const BidScheduleGanttView = dynamic(
  () =>
    import("@/components/bid-schedule/schedule-modes").then((mod) => ({
      default: mod.BidScheduleGantt,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        Loading Gantt…
      </p>
    ),
  }
);

export function BidScheduleGanttLazy({
  jobs,
  canEdit = false,
}: {
  jobs: ScheduleModeJob[];
  canEdit?: boolean;
}) {
  return <BidScheduleGanttView jobs={jobs} canEdit={canEdit} />;
}
