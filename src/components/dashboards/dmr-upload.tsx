"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { importDmrUpload } from "@/actions/dmr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function parseCsv(text: string): { jobNumber: string; dmrValue: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const rows: { jobNumber: string; dmrValue: number }[] = [];
  const start = lines[0]!.toLowerCase().includes("jobnumber") ? 1 : 0;

  for (let i = start; i < lines.length; i++) {
    const parts = lines[i]!.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    const jobNumber = parts[0];
    const dmrValue = Number(parts[1]?.replace(/[$,]/g, ""));
    if (!jobNumber || !Number.isFinite(dmrValue)) continue;
    rows.push({ jobNumber, dmrValue });
  }
  return rows;
}

export function DmrUpload() {
  const [pending, startTransition] = useTransition();
  const [csv, setCsv] = useState("");
  const router = useRouter();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const name = String(fd.get("name") ?? "").trim() || "DMR upload";
        const lines = parseCsv(csv);
        if (lines.length === 0) {
          toast.error("Paste CSV with jobNumber,dmrValue rows.");
          return;
        }
        startTransition(async () => {
          try {
            const importId = await importDmrUpload({ name, lines });
            toast.success(`Imported ${lines.length} DMR lines.`);
            router.push(`/dashboards/reconciliation?importId=${importId}`);
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Import failed");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="dmr-name">Import name</Label>
        <Input id="dmr-name" name="name" placeholder="DMR — March 2026" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dmr-csv">CSV (jobNumber, dmrValue)</Label>
        <Textarea
          id="dmr-csv"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"jobNumber,dmrValue\n12345,1500000\n67890,2200000"}
          rows={8}
          className="font-mono text-xs"
        />
      </div>
      <Button type="submit" size="sm" className="gap-1.5" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Upload &amp; reconcile
      </Button>
    </form>
  );
}
