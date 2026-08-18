"use client";

import { Loader2, Pause, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createReportSchedule,
  deleteReportSchedule,
  pauseReportSchedule,
  resumeReportSchedule,
} from "@/actions/report-schedules";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 5, label: "Friday" },
  { value: 0, label: "Sunday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 6, label: "Saturday" },
];

export type ReportScheduleRow = {
  id: number;
  name: string;
  savedReportId: number | null;
  weekday: number | null;
  hour: number | null;
  timezone: string;
  paused: boolean;
  lastSentAt: string | null;
  lastPeriodKey: string | null;
};

export function ReportSchedulesPanel({
  ownedReports,
  schedules,
}: {
  ownedReports: { id: number; name: string }[];
  schedules: ReportScheduleRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reportId, setReportId] = useState(ownedReports[0]?.id ?? 0);
  const [weekday, setWeekday] = useState(5);
  const [hour, setHour] = useState(8);

  const weekdayLabel = (value: number | null) =>
    WEEKDAYS.find((day) => day.value === value)?.label ?? "—";

  const run = (fn: () => Promise<void>, ok: string) => {
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Schedule update failed"
        );
      }
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Email schedules</CardTitle>
        <CardDescription>
          Mail a saved report Friday or Monday at 8am (or another hour).
          Delivery is idempotent per period — a second cron fire the same
          morning sends nothing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ownedReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Save a report first to schedule it.
          </p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                await createReportSchedule({
                  savedReportId: reportId,
                  weekday,
                  hour,
                });
              }, "Schedule created");
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="sched-report">Report</Label>
              <select
                id="sched-report"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                value={reportId}
                onChange={(e) => setReportId(Number(e.target.value))}
              >
                {ownedReports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sched-day">Day</Label>
              <select
                id="sched-day"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sched-hour">Hour</Label>
              <select
                id="sched-hour"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
              >
                {[7, 8, 9, 16].map((value) => (
                  <option key={value} value={value}>
                    {String(value).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" disabled={pending || !reportId}>
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Add schedule
            </Button>
          </form>
        )}

        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schedules yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {schedules.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {weekdayLabel(row.weekday)} at{" "}
                    {String(row.hour ?? 0).padStart(2, "0")}:00 {row.timezone}
                    {row.paused ? " · paused" : ""}
                    {row.lastPeriodKey ? ` · last ${row.lastPeriodKey}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={
                      row.paused ? "Resume schedule" : "Pause schedule"
                    }
                    onClick={() =>
                      run(
                        () =>
                          row.paused
                            ? resumeReportSchedule({ listId: row.id })
                            : pauseReportSchedule({ listId: row.id }),
                        row.paused ? "Schedule resumed" : "Schedule paused"
                      )
                    }
                  >
                    {row.paused ? (
                      <Play className="size-3.5" />
                    ) : (
                      <Pause className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label="Delete schedule"
                    onClick={() =>
                      run(
                        () => deleteReportSchedule({ listId: row.id }),
                        "Schedule deleted"
                      )
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
