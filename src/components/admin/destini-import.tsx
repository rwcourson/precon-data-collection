"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  confirmDestiniImport,
  previewDestiniCsvText,
  previewDestiniFile,
  type DestiniPreviewResult,
  type DestiniPreviewRow,
} from "@/actions/destini";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FIELD_MAP } from "@/lib/fields";
import { cn } from "@/lib/utils";

function fmt(v: number | string | null) {
  if (v == null || v === "") return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

function diffsForRound(row: DestiniPreviewRow, roundId: number | null) {
  const selected = row.rounds.find((r) => r.id === roundId) ?? null;
  if (!selected) return [];
  return (Object.keys(row.values) as (keyof typeof row.values)[]).map((key) => {
    const current = selected.current[key] ?? null;
    const incoming = row.values[key] ?? null;
    return {
      key,
      label: FIELD_MAP[key]?.label ?? String(key),
      current,
      incoming,
      changed: String(current ?? "") !== String(incoming ?? ""),
    };
  });
}

function PreviewBlock({
  row,
  roundId,
  onRoundChange,
  onConfirm,
  pending,
}: {
  row: DestiniPreviewRow;
  roundId: number | null;
  onRoundChange: (id: number) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const diffs = diffsForRound(row, roundId);
  const hardError =
    row.error?.startsWith("No job") ||
    row.error?.startsWith("Missing") ||
    row.error?.startsWith("Job has no");
  const canConfirm =
    Boolean(roundId) &&
    Object.keys(row.values).length > 0 &&
    diffs.some((d) => d.changed) &&
    !hardError;

  return (
    <div className="space-y-3 rounded-md border p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">
              Job {row.jobNumber ?? "—"}
              {row.matchedJobName ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {row.matchedJobName}
                </span>
              ) : null}
            </p>
            {row.jobName && row.jobName !== row.matchedJobName ? (
              <Badge variant="secondary" size="sm">
                Destini name: {row.jobName}
              </Badge>
            ) : null}
          </div>
          {row.error ? (
            <p className="text-2xs text-warning-foreground">{row.error}</p>
          ) : (
            <p className="text-2xs text-muted-foreground">
              {Object.keys(row.values).length} Destini field
              {Object.keys(row.values).length === 1 ? "" : "s"} ready
              {row.skippedEmpty.length
                ? ` · ${row.skippedEmpty.length} empty in file`
                : ""}
            </p>
          )}
        </div>

        {row.rounds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={roundId != null ? String(roundId) : ""}
              onValueChange={(v) => {
                if (v) onRoundChange(Number(v));
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select round" />
              </SelectTrigger>
              <SelectContent>
                {row.rounds.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.estimatePhase ?? `Round ${r.roundNumber}`} · {r.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={pending || !canConfirm}
              onClick={onConfirm}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm import
            </Button>
          </div>
        )}
      </div>

      {diffs.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>From Destini</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diffs.map((d) => (
                <TableRow
                  key={d.key}
                  className={cn(d.changed && "bg-info-soft/40")}
                >
                  <TableCell className="text-xs font-medium">{d.label}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {fmt(d.current)}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {fmt(d.incoming)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {row.unmappedHeaders.length > 0 && (
        <p className="text-2xs text-muted-foreground">
          Ignored (not Destini-sourced): {row.unmappedHeaders.slice(0, 8).join(", ")}
          {row.unmappedHeaders.length > 8 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

export function DestiniImport() {
  const [pending, startTransition] = useTransition();
  const [csv, setCsv] = useState("");
  const [showCsv, setShowCsv] = useState(false);
  const [preview, setPreview] = useState<DestiniPreviewResult | null>(null);
  const [roundPick, setRoundPick] = useState<Record<number, number>>({});

  const applyPreview = (result: DestiniPreviewResult) => {
    setPreview(result);
    const picks: Record<number, number> = {};
    for (const row of result.rows) {
      if (row.suggestedRoundId != null) picks[row.index] = row.suggestedRoundId;
    }
    setRoundPick(picks);
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      try {
        const result = await previewDestiniFile(fd);
        applyPreview(result);
        if (result.rows.length === 0) {
          toast.message("File parsed, but no data rows were found.");
        } else {
          toast.success(
            `Parsed ${result.format} sheet “${result.sheetName}” — review before confirming.`,
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Preview failed", {
          duration: 6000,
        });
      }
    });
  };

  const confirmRow = (row: DestiniPreviewRow) => {
    const roundId = roundPick[row.index];
    if (roundId == null) {
      toast.error("Select an estimate round first.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await confirmDestiniImport({
          roundId,
          values: row.values as Record<string, number | string | null>,
        });
        toast.success(`Imported ${result.fields} fields onto round #${result.roundId}.`);
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                rows: prev.rows.filter((r) => r.index !== row.index),
              }
            : null,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed", {
          duration: 6000,
        });
      }
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Imports Destini-sourced dollars and staffing only (estimate value, back-page fee,
        labor, GC/GR Owner SOV, PM months, GSF, etc.). Judgmental fields like Fee Expected,
        contingency, and self-perform stay manual.
      </p>

      <div className="space-y-2">
        <Label htmlFor="destini-file">Destini report (.xlsx or .csv)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="destini-file"
            type="file"
            accept=".xlsx,.xlsm,.csv,.txt"
            className="block w-full max-w-md text-xs file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium"
            disabled={pending}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowCsv((v) => !v)}
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", showCsv && "rotate-180")}
          />
          Or paste CSV
        </button>
        {showCsv && (
          <form
            className="mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!csv.trim()) {
                toast.error("Paste CSV first.");
                return;
              }
              startTransition(async () => {
                try {
                  const result = await previewDestiniCsvText(csv);
                  applyPreview(result);
                  toast.success("CSV preview ready — review before confirming.");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Preview failed");
                }
              });
            }}
          >
            <Textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={
                "Job Number,Estimate Phase,Estimate Value $\n12345,GMP,1500000"
              }
              rows={8}
              className="font-mono text-xs"
            />
            <Button type="submit" size="sm" className="gap-1.5" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Preview CSV
            </Button>
          </form>
        )}
      </div>

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Preview · {preview.format} · {preview.sheetName}
            </p>
            <Badge variant="outline" size="sm">
              {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"}
            </Badge>
          </div>
          {preview.rows.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing to import — file had no mapped values (empty Input column is fine for
              markup templates).
            </p>
          ) : (
            preview.rows.map((row) => (
              <PreviewBlock
                key={row.index}
                row={row}
                roundId={roundPick[row.index] ?? null}
                onRoundChange={(id) =>
                  setRoundPick((prev) => ({ ...prev, [row.index]: id }))
                }
                onConfirm={() => confirmRow(row)}
                pending={pending}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
