"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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

const WIDGET_KINDS = ["kpi", "bar", "line", "area", "table", "projection"] as const;
const METRIC_KEYS = [
  "estimateValue",
  "feeExpected",
  "feeExpectedPct",
  "contingencyTotal",
  "roundCount",
  "winRate",
] as const;

export function StudioWidgetForm({ dashboardId }: { dashboardId: number }) {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<(typeof WIDGET_KINDS)[number]>("kpi");
  const [metricKey, setMetricKey] = useState<string>(METRIC_KEYS[0]);
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
            });
            toast.success("Widget added.");
            (e.target as HTMLFormElement).reset();
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Add widget failed");
          }
        });
      }}
    >
      <div className="min-w-[160px] flex-1 space-y-1.5">
        <Label htmlFor="widget-title">Title</Label>
        <Input id="widget-title" name="title" placeholder="Pursuit volume" required />
      </div>
      <div className="space-y-1.5">
        <Label>Kind</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WIDGET_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
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
      <Button type="submit" size="sm" className="gap-1.5" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add widget
      </Button>
    </form>
  );
}
