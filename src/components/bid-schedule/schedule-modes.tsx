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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {jobs.map((job) => (
        <Card
          key={job.jobId}
          className="min-w-0"
          data-schedule-job-id={job.jobId}
        >
          <CardHeader className="gap-2 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/jobs/${job.jobId}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {displayJobNumber(job.jobNumber)}
                </Link>
                <CardTitle className="truncate text-sm">
                  {job.jobName}
                </CardTitle>
              </div>
              <Badge variant="secondary" size="sm">
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
          <CardContent className="space-y-1.5">
            {job.efforts.map((effort) => (
              <Link
                key={effort.id}
                href={`/rounds/${effort.id}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <StatusBadge status={effort.status} />
                <span className="truncate">{effort.estimatePhase}</span>
                <span className="font-mono text-2xs text-muted-foreground">
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
        .map((date) => new Date(`${date}T00:00:00Z`).getTime())
    )
  );
  const today = new Date();
  const fallbackStart = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    1
  );
  const min = timestamps.length ? Math.min(...timestamps) : fallbackStart;
  const max = timestamps.length
    ? Math.max(...timestamps)
    : fallbackStart + 31 * 86_400_000;
  const span = Math.max(max - min, 86_400_000);

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <CardTitle>Current schedule timeline</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              The same filtered jobs as the table. Bars run from drawings due to
              bid due; no people or staffing dates move automatically.
            </p>
          </div>
          <p className="font-mono text-2xs text-muted-foreground">
            {new Date(min).toLocaleDateString()} —{" "}
            {new Date(max).toLocaleDateString()}
          </p>
        </div>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {jobs.map((job) => (
          <div
            key={job.jobId}
            className="grid min-w-[44rem] grid-cols-[14rem_1fr] gap-3 px-3 py-2"
            data-schedule-job-id={job.jobId}
          >
            <div className="min-w-0">
              <Link
                href={`/jobs/${job.jobId}`}
                className="block truncate text-xs font-medium hover:text-primary hover:underline"
              >
                {job.jobName}
              </Link>
              <span className="font-mono text-2xs text-muted-foreground">
                {displayJobNumber(job.jobNumber)}
              </span>
            </div>
            <div
              className="relative min-h-8 rounded-md bg-muted/50"
              style={{
                minHeight: `${Math.max(32, job.efforts.length * 18 + 4)}px`,
              }}
            >
              {job.efforts.map((effort, index) => (
                <GanttEffortBar
                  key={effort.id}
                  effort={effort}
                  index={index}
                  min={min}
                  span={span}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GanttEffortBar({
  effort,
  index,
  min,
  span,
  canEdit,
}: {
  effort: ScheduleModeJob["efforts"][number];
  index: number;
  min: number;
  span: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bidDueDate, setBidDueDate] = useState(effort.bidDueDate ?? "");
  const [pending, startSave] = useTransition();

  if (!effort.bidDueDate) {
    return (
      <Link
        href={`/rounds/${effort.id}`}
        className="absolute right-1 rounded bg-warning-soft px-1.5 py-0.5 text-2xs text-warning-foreground"
        style={{ top: `${index * 18 + 2}px` }}
      >
        Bid date unclear
      </Link>
    );
  }

  const end = new Date(`${effort.bidDueDate}T00:00:00Z`).getTime();
  const barStart = effort.drawingsDueDate
    ? new Date(`${effort.drawingsDueDate}T00:00:00Z`).getTime()
    : end - 7 * 86_400_000;
  const left = Math.max(0, ((barStart - min) / span) * 100);
  const width = Math.max(2, ((end - barStart) / span) * 100);
  const barClass =
    "absolute h-3.5 overflow-hidden rounded-full bg-primary px-1 text-[9px] leading-3.5 text-primary-foreground outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-safe:transition-[filter]";
  const barStyle = {
    left: `${left}%`,
    top: `${index * 18 + 2}px`,
    width: `${Math.min(width, 100 - left)}%`,
  };

  if (!canEdit) {
    return (
      <Link
        href={`/rounds/${effort.id}`}
        className={barClass}
        style={barStyle}
        title={`${effort.estimatePhase}: ${fmtDate(effort.drawingsDueDate)} to ${fmtDate(effort.bidDueDate)}`}
      >
        {effort.estimatePhase}
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={barClass}
            style={barStyle}
            title={`${effort.estimatePhase}: ${fmtDate(effort.drawingsDueDate)} to ${fmtDate(effort.bidDueDate)}. Click to edit the bid date.`}
          />
        }
      >
        {effort.estimatePhase}
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
