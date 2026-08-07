"use client";

import { useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { importDestiniRows } from "@/actions/destini";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function parseCsvTable(text: string): { headers: string[]; rows: unknown[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = parseLine(lines[0]!);
  const rows = lines.slice(1).map((line) => parseLine(line));
  return { headers, rows };
}

export function DestiniImport() {
  const [pending, startTransition] = useTransition();
  const [csv, setCsv] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const { headers, rows } = parseCsvTable(csv);
        if (headers.length === 0 || rows.length === 0) {
          toast.error("Paste CSV with a header row and at least one data row.");
          return;
        }
        startTransition(async () => {
          try {
            const result = await importDestiniRows({ headers, rows });
            toast.success(
              `Imported ${result.updated} of ${result.total} rows (${result.unmatched} unmatched).`,
              { duration: 6000 },
            );
            setCsv("");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Import failed", {
              duration: 6000,
            });
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="destini-csv">Destini export (CSV)</Label>
        <Textarea
          id="destini-csv"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={
            "Job Number,Estimate Phase,Grand Total,Fee Expected\n12345,ROM,1500000,75000"
          }
          rows={12}
          className="font-mono text-xs"
        />
        <p className="text-2xs text-muted-foreground">
          First row is treated as headers and mapped to post-bid fields. Rows match jobs by job
          number and estimate phase.
        </p>
      </div>
      <Button type="submit" size="sm" className="gap-1.5" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Import to post-bid
      </Button>
    </form>
  );
}
