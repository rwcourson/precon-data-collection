"use client";

import {
  ChevronDown,
  Loader2,
  Play,
  Plus,
  Save,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteReport,
  runReport,
  saveReport,
  shareReport,
} from "@/actions/reports";
import { ExportActions } from "@/components/export-actions";
import { Badge, BadgeRemove } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SavedReportConfig } from "@/db/schema";
import {
  formatReportValue,
  type ReportFieldDef,
  type ReportResult,
} from "@/lib/report-engine";
import { reportColumnMeta, reportColumnWidth } from "@/lib/report-layout";
import { cn } from "@/lib/utils";

type SavedReportRow = {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  config: SavedReportConfig;
  sharedWithRegions: string[];
  sharedWithUserIds: number[];
};

const OPS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equal" },
  { value: "contains", label: "contains" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "notblank", label: "is not blank" },
];

const AGG_FNS = ["sum", "avg", "count", "min", "max"] as const;

const EMPTY: SavedReportConfig = {
  fields: [
    "region",
    "jobName",
    "estimatePhase",
    "bidYear",
    "estimateValue",
    "metric:feeExpectedPct",
  ],
  filters: [],
  groupBy: [],
  aggregations: [],
  sortBy: [],
};

export function ReportBuilder({
  catalog,
  saved,
  currentUserId,
  regions,
  users,
}: {
  catalog: ReportFieldDef[];
  saved: SavedReportRow[];
  currentUserId: number;
  regions: string[];
  users: { id: number; name: string }[];
}) {
  const [config, setConfig] = useState<SavedReportConfig>(EMPTY);
  const [name, setName] = useState("");
  const [reportId, setReportId] = useState<number | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [running, startRun] = useTransition();
  const [saving, startSave] = useTransition();
  const [shareOpen, setShareOpen] = useState(false);
  const router = useRouter();

  const labelOf = (key: string) =>
    catalog.find((c) => c.key === key)?.label ?? key;
  const numericFields = catalog.filter((c) =>
    ["number", "dollars", "metric"].includes(c.type)
  );

  const categories = [...new Set(catalog.map((c) => c.category))];

  function load(r: SavedReportRow) {
    setConfig(r.config);
    setName(r.name);
    setReportId(r.id);
    setResult(null);
    toast.success(`Loaded "${r.name}"`);
  }

  function run() {
    startRun(async () => {
      try {
        setResult(await runReport(config));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Report failed");
      }
    });
  }

  function persist() {
    startSave(async () => {
      try {
        const id = await saveReport(name, config, reportId ?? undefined);
        setReportId(id);
        toast.success(`Report "${name}" saved`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  const exportUrl = (format: "xlsx" | "pdf") =>
    `/api/export/report?format=${format}&name=${encodeURIComponent(name || "Custom Report")}&config=${encodeURIComponent(JSON.stringify(config))}`;

  const currentReport = saved.find((s) => s.id === reportId);

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Saved Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-3">
            <button
              type="button"
              className="w-full rounded-md border border-dashed px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              onClick={() => {
                setConfig(EMPTY);
                setName("");
                setReportId(null);
                setResult(null);
              }}
            >
              <Plus className="mr-1 inline size-3" /> New blank report
            </button>
            {saved.map((r) => (
              <div
                key={r.id}
                className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-accent ${
                  reportId === r.id ? "bg-accent" : ""
                }`}
              >
                <button
                  type="button"
                  className="flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  onClick={() => load(r)}
                >
                  <p className="font-medium leading-tight">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.ownerId === currentUserId
                      ? "Mine"
                      : `Shared by ${r.ownerName}`}
                    {r.sharedWithRegions.length > 0 &&
                      ` · shared with ${r.sharedWithRegions.join(", ")}`}
                  </p>
                </button>
                {r.ownerId === currentUserId && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete report ${r.name}`}
                    onClick={async () => {
                      try {
                        await deleteReport(r.id);
                        if (reportId === r.id) setReportId(null);
                        router.refresh();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Delete failed"
                        );
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            {saved.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No saved reports yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            {/* Fields */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fields</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {config.fields.map((f) => (
                  <Badge key={f} variant="secondary">
                    {labelOf(f)}
                    <BadgeRemove
                      label={labelOf(f)}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          fields: c.fields.filter((x) => x !== f),
                        }))
                      }
                    />
                  </Badge>
                ))}
                <FieldPicker
                  catalog={catalog}
                  categories={categories}
                  selected={config.fields}
                  onToggle={(key) =>
                    setConfig((c) => ({
                      ...c,
                      fields: c.fields.includes(key)
                        ? c.fields.filter((x) => x !== key)
                        : [...c.fields, key],
                    }))
                  }
                />
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Filters</Label>
              {config.filters.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <MiniSelect
                    value={f.field}
                    onChange={(v) =>
                      setConfig((c) => ({
                        ...c,
                        filters: c.filters.map((x, j) =>
                          j === i ? { ...x, field: v } : x
                        ),
                      }))
                    }
                    options={catalog.map((c) => ({
                      value: c.key,
                      label: c.label,
                    }))}
                    className="w-52"
                  />
                  <MiniSelect
                    value={f.op}
                    onChange={(v) =>
                      setConfig((c) => ({
                        ...c,
                        filters: c.filters.map((x, j) =>
                          j === i ? { ...x, op: v } : x
                        ),
                      }))
                    }
                    options={OPS}
                    className="w-32"
                  />
                  {f.op !== "notblank" && (
                    <Input
                      className="h-8 w-44 text-xs"
                      value={f.value}
                      placeholder="Value…"
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          filters: c.filters.map((x, j) =>
                            j === i ? { ...x, value: e.target.value } : x
                          ),
                        }))
                      }
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove filter"
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        filters: c.filters.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    filters: [
                      ...c.filters,
                      { field: "status", op: "eq", value: "" },
                    ],
                  }))
                }
              >
                <Plus className="size-3" /> Add filter
              </Button>
            </div>

            <div className="grid gap-x-6 gap-y-4 border-t border-border/60 pt-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Group by</Label>
                <div className="flex min-h-7 flex-wrap items-center gap-1.5">
                  {config.groupBy.map((g) => (
                    <Badge key={g} variant="secondary">
                      {labelOf(g)}
                      <BadgeRemove
                        label={labelOf(g)}
                        onClick={() =>
                          setConfig((c) => ({
                            ...c,
                            groupBy: c.groupBy.filter((x) => x !== g),
                          }))
                        }
                      />
                    </Badge>
                  ))}
                  <MiniSelect
                    value=""
                    placeholder="+ Add"
                    onChange={(v) =>
                      v &&
                      setConfig((c) => ({
                        ...c,
                        groupBy: c.groupBy.includes(v)
                          ? c.groupBy
                          : [...c.groupBy, v],
                        aggregations:
                          c.aggregations.length === 0
                            ? [
                                { field: "id", fn: "count" },
                                { field: "estimateValue", fn: "sum" },
                              ]
                            : c.aggregations,
                      }))
                    }
                    options={catalog
                      .filter((c) =>
                        ["dropdown", "text", "number"].includes(c.type)
                      )
                      .map((c) => ({ value: c.key, label: c.label }))}
                    className="h-7 w-36"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Aggregations</Label>
                {config.groupBy.length === 0 ? (
                  <p className="flex min-h-7 items-center text-xs text-muted-foreground">
                    Add a grouping to aggregate.
                  </p>
                ) : (
                  <>
                    {config.aggregations.map((a, i) => (
                      <div
                        key={i}
                        className="flex min-h-7 items-center gap-1.5"
                      >
                        <MiniSelect
                          value={a.fn}
                          onChange={(v) =>
                            setConfig((c) => ({
                              ...c,
                              aggregations: c.aggregations.map((x, j) =>
                                j === i
                                  ? { ...x, fn: v as (typeof AGG_FNS)[number] }
                                  : x
                              ),
                            }))
                          }
                          options={AGG_FNS.map((f) => ({
                            value: f,
                            label: f.toUpperCase(),
                          }))}
                          className="h-7 w-24"
                        />
                        <MiniSelect
                          value={a.field}
                          onChange={(v) =>
                            setConfig((c) => ({
                              ...c,
                              aggregations: c.aggregations.map((x, j) =>
                                j === i ? { ...x, field: v } : x
                              ),
                            }))
                          }
                          options={[
                            { value: "id", label: "Records" },
                            ...numericFields.map((f) => ({
                              value: f.key,
                              label: f.label,
                            })),
                          ]}
                          className="h-7 w-44"
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove aggregation"
                          onClick={() =>
                            setConfig((c) => ({
                              ...c,
                              aggregations: c.aggregations.filter(
                                (_, j) => j !== i
                              ),
                            }))
                          }
                        >
                          <X />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          aggregations: [
                            ...c.aggregations,
                            { field: "estimateValue", fn: "sum" },
                          ],
                        }))
                      }
                    >
                      <Plus className="size-3" /> Add aggregation
                    </Button>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Sort</Label>
                {config.sortBy.map((s, i) => (
                  <div key={i} className="flex min-h-7 items-center gap-1.5">
                    <MiniSelect
                      value={s.field}
                      onChange={(v) =>
                        setConfig((c) => ({
                          ...c,
                          sortBy: c.sortBy.map((x, j) =>
                            j === i ? { ...x, field: v } : x
                          ),
                        }))
                      }
                      options={catalog.map((c) => ({
                        value: c.key,
                        label: c.label,
                      }))}
                      className="h-7 w-44"
                    />
                    <MiniSelect
                      value={s.dir}
                      onChange={(v) =>
                        setConfig((c) => ({
                          ...c,
                          sortBy: c.sortBy.map((x, j) =>
                            j === i ? { ...x, dir: v as "asc" | "desc" } : x
                          ),
                        }))
                      }
                      options={[
                        { value: "asc", label: "Asc" },
                        { value: "desc", label: "Desc" },
                      ]}
                      className="h-7 w-20"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove sort"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          sortBy: c.sortBy.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      sortBy: [
                        ...c.sortBy,
                        { field: config.fields[0] ?? "region", dir: "asc" },
                      ],
                    }))
                  }
                >
                  <Plus className="size-3" /> Add sort
                </Button>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="flex items-center gap-1.5">
                <Input
                  placeholder="Report name…"
                  className="h-8 w-52 text-xs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving || !name.trim()}
                  onClick={persist}
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  {reportId ? "Update" : "Save"}
                </Button>
                {reportId != null &&
                  currentReport?.ownerId === currentUserId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShareOpen(true)}
                    >
                      <Share2 className="size-3.5" /> Share
                    </Button>
                  )}
              </div>
              <div className="flex items-center gap-1.5">
                <ExportActions
                  excelHref={exportUrl("xlsx")}
                  pdfHref={exportUrl("pdf")}
                />
                <Button size="sm" onClick={run} disabled={running}>
                  {running ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Run Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="min-w-0">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm">
              Results{" "}
              <span className="font-normal text-muted-foreground">
                ({result.rows.length} row{result.rows.length === 1 ? "" : "s"}
                {result.isGrouped ? ", grouped" : ""})
              </span>
            </CardTitle>
            {result.grainFooter ? (
              <p className="text-sm font-normal text-muted-foreground">
                {result.grainFooter}
              </p>
            ) : null}
            {result.rows.length > 0 ? (
              <CardAction>
                <ExportActions
                  excelHref={exportUrl("xlsx")}
                  pdfHref={exportUrl("pdf")}
                />
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {result.rows.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center gap-1 px-6 text-center">
                <p className="text-sm font-medium">No rows matched</p>
                <p className="text-xs text-muted-foreground">
                  Loosen filters or pick different fields, then run again.
                </p>
              </div>
            ) : (
              <div className="max-h-[min(70vh,48rem)] overflow-auto">
                <table className="w-full table-fixed caption-bottom text-sm">
                  <colgroup>
                    {result.columns.map((c) => (
                      <col
                        key={c.key}
                        style={{
                          width: reportColumnWidth(
                            c.key,
                            result.columns,
                            catalog
                          ),
                        }}
                      />
                    ))}
                  </colgroup>
                  <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                    <TableRow>
                      {result.columns.map((c) => {
                        const meta = reportColumnMeta(c.key, catalog);
                        return (
                          <TableHead
                            key={c.key}
                            className={cn(
                              "px-3 first:pl-5 last:pr-5",
                              meta.numeric && "text-right"
                            )}
                          >
                            {c.label}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((r, i) => (
                      <TableRow key={i}>
                        {result.columns.map((c) => {
                          const meta = reportColumnMeta(c.key, catalog);
                          const display = formatReportValue(
                            c.key,
                            r[c.key] ?? null,
                            catalog
                          );
                          return (
                            <TableCell
                              key={c.key}
                              title={display === "—" ? undefined : display}
                              className={cn(
                                "px-3 text-sm first:pl-5 last:pr-5",
                                meta.wrap
                                  ? "whitespace-normal break-words"
                                  : "truncate",
                                meta.numeric && "text-right tabular-nums"
                              )}
                            >
                              {display}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share &quot;{currentReport?.name}&quot;</DialogTitle>
            <DialogDescription>
              Saved reports are personal by default. Share with specific people
              or an entire Region.
            </DialogDescription>
          </DialogHeader>
          {currentReport && (
            <ShareForm
              report={currentReport}
              regions={regions}
              users={users.filter((u) => u.id !== currentUserId)}
              onDone={() => {
                setShareOpen(false);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShareForm({
  report,
  regions,
  users,
  onDone,
}: {
  report: SavedReportRow;
  regions: string[];
  users: { id: number; name: string }[];
  onDone: () => void;
}) {
  const [selRegions, setSelRegions] = useState<string[]>(
    report.sharedWithRegions
  );
  const [selUsers, setSelUsers] = useState<number[]>(report.sharedWithUserIds);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Regions</Label>
        <div className="flex flex-wrap gap-2">
          {regions.map((r) => (
            <label key={r} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={selRegions.includes(r)}
                onCheckedChange={(v) =>
                  setSelRegions((s) =>
                    v ? [...s, r] : s.filter((x) => x !== r)
                  )
                }
              />
              {r}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">People</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={selUsers.includes(u.id)}
                onCheckedChange={(v) =>
                  setSelUsers((s) =>
                    v ? [...s, u.id] : s.filter((x) => x !== u.id)
                  )
                }
              />
              {u.name}
            </label>
          ))}
        </div>
      </div>
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await shareReport(report.id, selRegions, selUsers);
              toast.success("Sharing updated");
              onDone();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Share failed");
            }
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Update Sharing
      </Button>
    </div>
  );
}

function FieldPicker({
  catalog,
  categories,
  selected,
  onToggle,
}: {
  catalog: ReportFieldDef[];
  categories: string[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const matches = needle
    ? catalog.filter(
        (c) =>
          c.label.toLowerCase().includes(needle) ||
          c.category.toLowerCase().includes(needle)
      )
    : catalog;
  const visibleCategories = categories.filter((cat) =>
    matches.some((c) => c.category === cat)
  );

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="xs" className="gap-1" />}
      >
        <Plus className="size-3" /> Add field <ChevronDown className="size-3" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b p-1.5">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Search ${catalog.length} fields…`}
            className="h-7 text-xs"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {visibleCategories.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No fields match “{filter}”.
            </p>
          )}
          {visibleCategories.map((cat) => (
            <div key={cat}>
              <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {cat}
              </p>
              {matches
                .filter((c) => c.category === cat)
                .map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30"
                    onClick={() => onToggle(c.key)}
                  >
                    <Checkbox
                      checked={selected.includes(c.key)}
                      className="pointer-events-none size-3.5"
                    />
                    {c.label}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MiniSelect({
  value,
  onChange,
  options,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  placeholder?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(v) => onChange(v ?? "")}
    >
      <SelectTrigger size="sm" className={cn("h-7 text-xs", className)}>
        <SelectValue placeholder={placeholder ?? "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
