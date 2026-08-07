"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileSpreadsheet,
  FileText,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FIELD_DEFS } from "@/lib/fields";
import type { ExportTemplateConfig } from "@/db/schema";
import { deleteReportTemplate, saveReportTemplate } from "@/actions/templates";

const DEFAULT_COLUMNS = [
  "jobNumber",
  "jobName",
  "estimatePhase",
  "bidYear",
  "bidDueDate",
  "estimateLead",
  "marketSector",
  "contractType",
];

const GROUPABLE = ["region", "preconDepartment", "estimatePhase", "bidYear", "marketSector", "mlt"];

type Template = { id: number; name: string; config: ExportTemplateConfig };

export function ExportDialog({
  queryString,
  templates,
  customCols = [],
}: {
  queryString: string;
  templates: Template[];
  customCols?: { key: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [groupBy, setGroupBy] = useState<string>("none");
  const [sortField, setSortField] = useState<string>("bidDueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [header, setHeader] = useState("Bid Schedule");
  const [footer, setFooter] = useState("Brasfield & Gorrie Preconstruction — Confidential");
  const [templateName, setTemplateName] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const available = useMemo(
    () => [
      ...FIELD_DEFS.filter((f) => f.type !== "multi").map((f) => ({
        key: f.key,
        label: f.label,
      })),
      // Region-specific custom columns surface automatically (Section 11)
      ...customCols,
    ],
    [customCols],
  );

  const config: ExportTemplateConfig = {
    columns,
    groupBy: groupBy === "none" ? [] : [groupBy],
    sortBy: [{ field: sortField, dir: sortDir }],
    header,
    footer,
  };

  function applyTemplate(t: Template) {
    setColumns(t.config.columns);
    setGroupBy(t.config.groupBy[0] ?? "none");
    setSortField(t.config.sortBy[0]?.field ?? "bidDueDate");
    setSortDir(t.config.sortBy[0]?.dir ?? "asc");
    setHeader(t.config.header ?? "");
    setFooter(t.config.footer ?? "");
    toast.success(`Template "${t.name}" applied`);
  }

  function toggle(key: string) {
    setColumns((cols) =>
      cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key],
    );
  }

  function move(key: string, dir: -1 | 1) {
    setColumns((cols) => {
      const i = cols.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cols.length) return cols;
      const next = [...cols];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const exportUrl = (format: "xlsx" | "pdf") =>
    `/api/export/bid-schedule?format=${format}&config=${encodeURIComponent(
      JSON.stringify(config),
    )}${queryString ? `&${queryString}` : ""}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <Download className="size-4" /> Export
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Bid Schedule</DialogTitle>
          <DialogDescription>
            Choose columns, order, grouping, and sorting. Save the configuration as a
            reusable template.
          </DialogDescription>
        </DialogHeader>

        {templates.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Saved templates</Label>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <span key={t.id} className="flex items-center rounded-md border bg-muted/40 pr-0.5">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="rounded-r-none font-medium"
                    onClick={() => applyTemplate(t)}
                  >
                    {t.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete template ${t.name}`}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await deleteReportTemplate(t.id);
                          router.refresh();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Delete failed");
                        }
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Columns (in export order)</Label>
            <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
              {columns.map((key) => {
                const def = available.find((f) => f.key === key);
                if (!def) return null;
                return (
                  <div key={key} className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent">
                    <Checkbox checked onCheckedChange={() => toggle(key)} />
                    <span className="flex-1 truncate text-xs">{def.label}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground"
                      aria-label={`Move ${def.label} earlier`}
                      onClick={() => move(key, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground"
                      aria-label={`Move ${def.label} later`}
                      onClick={() => move(key, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                );
              })}
              <Separator className="my-1" />
              {available
                .filter((f) => !columns.includes(f.key))
                .map((f) => (
                  <div key={f.key} className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent">
                    <Checkbox checked={false} onCheckedChange={() => toggle(f.key)} />
                    <span className="flex-1 truncate text-xs text-muted-foreground">{f.label}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Group rows by</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v ?? "none")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  {GROUPABLE.map((g) => (
                    <SelectItem key={g} value={g}>
                      {available.find((f) => f.key === g)?.label ?? g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Sort by</Label>
                <Select value={sortField} onValueChange={(v) => setSortField(v ?? "bidDueDate")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Direction</Label>
                <Select value={sortDir} onValueChange={(v) => setSortDir((v ?? "asc") as "asc" | "desc")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Header</Label>
              <Input value={header} onChange={(e) => setHeader(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Footer</Label>
              <Input value={footer} onChange={(e) => setFooter(e.target.value)} />
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Input
              placeholder="Template name…"
              className="h-8 w-44 text-xs"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={pending || !templateName.trim()}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await saveReportTemplate(templateName, config);
                    toast.success(`Template "${templateName}" saved`);
                    setTemplateName("");
                    router.refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Save failed");
                  }
                })
              }
            >
              <Save className="size-3.5" /> Save Template
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" nativeButton={false} render={<a href={exportUrl("xlsx")} />}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline" nativeButton={false}
              render={<a href={exportUrl("pdf")} target="_blank" rel="noreferrer" />}
            >
              <FileText className="size-4" /> PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
