"use client";

import { CalendarRange, Layers3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateRoundCell } from "@/actions/post-bid";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { RoundStatus } from "@/db/schema";
import { displayJobNumber, fmtDate } from "@/lib/format";
import {
  GANTT_LANE_PX,
  ganttBarRect,
  ganttMonthTicks,
  ganttRange,
  ganttTodayLeft,
  utcStamp,
} from "@/lib/schedule-gantt";
import { cn } from "@/lib/utils";

/** Reserved event for a future resource-management bar. Gantt never auto-slides people. */
export const RESOURCE_MANAGEMENT_EVENT = "resource.bar.future";

export type ScheduleModeJob = {
  jobId: number;
  jobName: string;
  jobNumber: string;
  focalRoundId: number;
  estimateLeadName: string | null;
  preconDepartment: string;
  marketSector: string | null;
  efforts: {
    id: number;
    roundNumber: number;
    estimatePhase: string;
    status: RoundStatus;
    drawingsDueDate: string | null;
    bidDueDate: string | null;
    updatedAt?: string | null;
  }[];
};

export function BidScheduleCards({ jobs }: { jobs: ScheduleModeJob[] }) {
  if (jobs.length === 0) return <ScheduleEmptyState />;
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {jobs.map((job) => (
        <Card
          key={job.jobId}
          className="min-w-0 gap-4 [--card-spacing:--spacing(5)]"
          data-schedule-job-id={job.jobId}
        >
          <CardHeader className="gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <Link
                  href={`/jobs/${job.jobId}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {displayJobNumber(job.jobNumber)}
                </Link>
                <CardTitle className="text-pretty text-sm leading-snug">
                  {job.jobName}
                </CardTitle>
              </div>
              <Badge variant="secondary" size="sm" className="mt-0.5 shrink-0">
                <Layers3 />
                {job.efforts.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" size="sm">
                {job.preconDepartment}
              </Badge>
              {job.estimateLeadName && (
                <Badge variant="outline" size="sm">
                  {job.estimateLeadName}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {job.efforts.map((effort) => (
              <Link
                key={effort.id}
                href={`/rounds/${effort.id}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-xs hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <StatusBadge status={effort.status} />
                <span className="truncate">{effort.estimatePhase}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {fmtDate(effort.bidDueDate)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function BidScheduleGantt({
  jobs,
  canEdit = false,
}: {
  jobs: ScheduleModeJob[];
  canEdit?: boolean;
}) {
  if (jobs.length === 0) return <ScheduleEmptyState />;
  const timestamps = jobs.flatMap((job) =>
    job.efforts.flatMap((effort) =>
      [effort.drawingsDueDate, effort.bidDueDate]
        .filter((date): date is string => Boolean(date))
        .map((date) => utcStamp(date))
    )
  );
  const { start, end, span } = ganttRange(timestamps);
  const ticks = ganttMonthTicks(start, end);
  const todayLeft = ganttTodayLeft(start, span);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b pb-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <CardTitle>Current schedule timeline</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              The same filtered jobs as the table. Bars run from drawings due to
              bid due; no people or staffing dates move automatically.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {fmtDate(new Date(start))} — {fmtDate(new Date(end))}
          </p>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <div className="min-w-[52rem]">
          <div className="sticky top-0 z-10 grid grid-cols-[16rem_minmax(0,1fr)] gap-4 border-b bg-card px-4 py-2">
            <p className="self-end text-xs font-medium text-muted-foreground">
              Job
            </p>
            <div className="relative h-6">
              {ticks.map((tick) => (
                <span
                  key={`${tick.label}-${tick.left}`}
                  className="absolute top-1 -translate-x-1/2 text-xs text-muted-foreground"
                  style={{ left: `${tick.left}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
          </div>
          <div className="divide-y">
            {jobs.map((job) => (
              <div
                key={job.jobId}
                className={cn(
                  "grid grid-cols-[16rem_minmax(0,1fr)] gap-4 px-4 py-2.5",
                  job.efforts.length > 1 ? "items-start" : "items-center"
                )}
                data-schedule-job-id={job.jobId}
              >
                <div className="min-w-0">
                  <Link
                    href={`/jobs/${job.jobId}`}
                    className="block truncate text-sm font-medium leading-5 hover:text-primary hover:underline"
                  >
                    {job.jobName}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    {displayJobNumber(job.jobNumber)}
                  </span>
                </div>
                <div
                  className="relative rounded-md bg-muted/40"
                  style={{
                    minHeight: `${Math.max(GANTT_LANE_PX, job.efforts.length * GANTT_LANE_PX) + 8}px`,
                  }}
                >
                  {ticks.map((tick) => (
                    <div
                      key={`${job.jobId}-${tick.label}-${tick.left}`}
                      className="absolute inset-y-0 w-px bg-border/70"
                      style={{ left: `${tick.left}%` }}
                    />
                  ))}
                  {todayLeft != null ? (
                    <div
                      className="absolute inset-y-1 w-px bg-destructive/80"
                      style={{ left: `${todayLeft}%` }}
                      title="Today"
                    />
                  ) : null}
                  {job.efforts.map((effort, index) => (
                    <GanttEffortBar
                      key={effort.id}
                      effort={effort}
                      index={index}
                      rangeStart={start}
                      span={span}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ganttBarClass =
  "absolute flex h-6 items-center overflow-hidden rounded-md px-2 text-xs font-medium leading-none outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-safe:transition-[filter]";

function GanttEffortBar({
  effort,
  index,
  rangeStart,
  span,
  canEdit,
}: {
  effort: ScheduleModeJob["efforts"][number];
  index: number;
  rangeStart: number;
  span: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bidDueDate, setBidDueDate] = useState(effort.bidDueDate ?? "");
  const [pending, startSave] = useTransition();
  const top = index * GANTT_LANE_PX + 4;

  if (!effort.bidDueDate) {
    return (
      <Link
        href={`/rounds/${effort.id}`}
        className={cn(
          ganttBarClass,
          "right-2 bg-warning-soft text-warning-foreground"
        )}
        style={{ top, left: "auto" }}
        title={`${effort.estimatePhase}: bid date unclear`}
      >
        Bid date unclear
      </Link>
    );
  }

  const end = utcStamp(effort.bidDueDate);
  const barStart = effort.drawingsDueDate
    ? utcStamp(effort.drawingsDueDate)
    : end - 7 * 86_400_000;
  const { left, width } = ganttBarRect(barStart, end, rangeStart, span);
  const title = `${effort.estimatePhase}: ${fmtDate(effort.drawingsDueDate)} to ${fmtDate(effort.bidDueDate)}`;
  const barStyle = {
    left: `${left}%`,
    top,
    width: `${width}%`,
    minWidth: "5.75rem",
    maxWidth: `calc(100% - ${left}% - 0.5rem)`,
  };

  if (!canEdit) {
    return (
      <Link
        href={`/rounds/${effort.id}`}
        className={cn(ganttBarClass, "bg-primary text-primary-foreground")}
        style={barStyle}
        title={title}
      >
        <span className="truncate">{effort.estimatePhase}</span>
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(ganttBarClass, "bg-primary text-primary-foreground")}
            style={barStyle}
            title={`${title}. Click to edit the bid date.`}
          />
        }
      >
        <span className="truncate">{effort.estimatePhase}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2">
        <p className="text-sm font-medium">{effort.estimatePhase}</p>
        <div className="space-y-1">
          <Label htmlFor={`gantt-bid-${effort.id}`}>Bid due</Label>
          <Input
            id={`gantt-bid-${effort.id}`}
            type="date"
            value={bidDueDate}
            onChange={(event) => setBidDueDate(event.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/rounds/${effort.id}`} />}
          >
            Open effort
          </Button>
          <Button
            size="sm"
            disabled={pending || !bidDueDate}
            onClick={() =>
              startSave(async () => {
                try {
                  await updateRoundCell(
                    effort.id,
                    "bidDueDate",
                    bidDueDate,
                    effort.updatedAt ?? undefined
                  );
                  toast.success("Bid date saved");
                  setOpen(false);
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Refresh and try again — someone else saved first."
                  );
                }
              })
            }
          >
            Save date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ScheduleEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
        <CalendarRange className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">No jobs match this view</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Clear a filter or switch sections. Your saved view remains unchanged.
        </p>
      </CardContent>
    </Card>
  );
}
