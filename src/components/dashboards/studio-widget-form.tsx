"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addWidget } from "@/actions/dashboards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WIDGET_KINDS = [
  "kpi",
  "bar",
  "horizontal_bar",
  "stacked_bar",
  "line",
  "area",
  "pie",
  "donut",
  "table",
  "projection",
] as const;

const METRIC_KEYS = [
  "estimateValue",
  "feeExpected",
  "feeExpectedPct",
  "contingencyTotal",
  "roundCount",
  "winRate",
] as const;

const GROUP_BY = [
  "region",
  "preconDepartment",
  "marketSector",
  "estimatePhase",
  "bidYear",
  "status",
  "outcome",
] as const;

export function StudioWidgetForm({ dashboardId }: { dashboardId: number }) {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<(typeof WIDGET_KINDS)[number]>("bar");
  const [metricKey, setMetricKey] = useState<string>(METRIC_KEYS[0]);
  const [groupBy, setGroupBy] = useState<string>(GROUP_BY[0]);
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const title = String(fd.get("title") ?? "").trim();
        if (!title) {
          toast.error("Title is required.");
          return;
        }
        startTransition(async () => {
          try {
            await addWidget(dashboardId, {
              title,
              kind,
              metricKey: metricKey || null,
              groupBy: kind === "kpi" ? null : groupBy,
              layout: {
                w: kind === "kpi" ? 3 : kind === "table" ? 12 : 6,
                h: kind === "kpi" ? 2 : 4,
                x: 0,
                y: 0,
              },
            });
            toast.success("Widget added.");
            (e.target as HTMLFormElement).reset();
            router.refresh();
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Add widget failed"
            );
          }
        });
      }}
    >
      <div className="grid min-w-[12rem] flex-1 gap-1.5">
        <Label htmlFor="widget-title">Title</Label>
        <Input
          id="widget-title"
          name="title"
          placeholder="Pursuit volume"
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Kind</Label>
        <Select
          items={WIDGET_KINDS.map((k) => ({
            value: k,
            label: k.replaceAll("_", " "),
          }))}
          value={kind}
          onValueChange={(v) => setKind(v as typeof kind)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WIDGET_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {k.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Metric</Label>
        <Select value={metricKey} onValueChange={(v) => v && setMetricKey(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRIC_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {kind !== "kpi" && (
        <div className="grid gap-1.5">
          <Label>Group by</Label>
          <Select value={groupBy} onValueChange={(v) => v && setGroupBy(v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_BY.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" className="gap-1.5" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        Add widget
      </Button>
    </form>
  );
}
