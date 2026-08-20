"use client";

import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  confirmDestiniImport,
  type DestiniPreviewRow,
  previewDestiniFile,
} from "@/actions/destini";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export function DestiniRoundImport({
  roundId,
  canEdit,
}: {
  roundId: number;
  canEdit: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DestiniPreviewRow | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [checksum, setChecksum] = useState("");
  const [pending, startTransition] = useTransition();

  const buildPreview = () => {
    if (!file) return;
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("file", file);
        const [result, hash] = await Promise.all([
          previewDestiniFile(form),
          crypto.subtle
            .digest("SHA-256", await file.arrayBuffer())
            .then((value) =>
              [...new Uint8Array(value)]
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join("")
            ),
        ]);
        const row =
          result.rows.find((candidate) =>
            candidate.rounds.some((round) => round.id === roundId)
          ) ?? (result.rows.length === 1 ? result.rows[0] : null);
        if (!row)
          throw new Error("This file does not match the current round.");
        const diffs = row.diffs.filter((diff) => diff.changed);
        setPreview(row);
        setSelected(diffs.map((diff) => diff.key));
        setChecksum(hash);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Destini preview failed"
        );
      }
    });
  };

  const apply = () => {
    if (!preview || !file) return;
    startTransition(async () => {
      try {
        await confirmDestiniImport({
          roundId,
          values: Object.fromEntries(
            Object.entries(preview.values).filter(([key]) =>
              selected.includes(key)
            )
          ),
          sourceName: file.name,
          checksum,
        });
        toast.success(`${selected.length} Destini fields applied`);
        setPreview(null);
        setSelected([]);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Destini import failed"
        );
      }
    });
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="size-4" />
          Fill from Destini export
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Preview every proposed value, choose what to accept, then apply it to
          this round. Blank source values and local fields are never overwritten
          silently.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="file"
            accept=".xlsx,.xlsm,.csv,.txt"
            disabled={!canEdit || pending}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="max-w-sm"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!file || !canEdit || pending}
            onClick={buildPreview}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Preview changes
          </Button>
        </div>
        {preview && (
          <div className="space-y-2">
            {preview.diffs
              .filter((diff) => diff.changed)
              .map((diff) => {
                const checked = selected.includes(diff.key);
                return (
                  <button
                    key={diff.key}
                    type="button"
                    className="grid w-full grid-cols-[auto_1fr] gap-2 rounded-md border p-2 text-left text-xs hover:bg-muted/50"
                    onClick={() =>
                      setSelected((current) =>
                        checked
                          ? current.filter((key) => key !== diff.key)
                          : [...current, diff.key]
                      )
                    }
                  >
                    <Checkbox
                      checked={checked}
                      className="pointer-events-none mt-0.5 size-3.5"
                    />
                    <span>
                      <span className="font-medium">{diff.label}</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        Local: {String(diff.current ?? "blank")} → Destini:{" "}
                        {String(diff.incoming ?? "blank")}
                      </span>
                    </span>
                  </button>
                );
              })}
            {preview.unmappedHeaders.length > 0 && (
              <Badge variant="warning">
                {preview.unmappedHeaders.length} unmapped source fields
              </Badge>
            )}
            <Button
              type="button"
              disabled={!selected.length || pending}
              onClick={apply}
            >
              Apply {selected.length} selected field
              {selected.length === 1 ? "" : "s"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
