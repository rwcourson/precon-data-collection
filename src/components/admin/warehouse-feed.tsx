"use client";

import { Database, Eye, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { runWarehouseFeed } from "@/actions/integrations";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FeedState } from "@/lib/integrations/databricks/feed";

export function WarehouseFeed({
  state,
  configured,
  table,
  connectMode,
  lastRunLabel,
  canRun,
  writesAllowed = false,
}: {
  state: FeedState;
  configured: boolean;
  table: string;
  connectMode: "disabled" | "mock" | "rest";
  lastRunLabel: string | null;
  canRun: boolean;
  /** Requires DATABRICKS_ALLOW_WRITE=true. Default off — read/pull only. */
  writesAllowed?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (previewOnly: boolean) =>
    startTransition(async () => {
      try {
        const res = await runWarehouseFeed(previewOnly);
        if (res.status === "failed") {
          toast.error(res.error ?? "Feed failed");
        } else if (res.status === "pushed") {
          toast.success(
            `Wrote ${res.rows.toLocaleString()} rows to ${res.table}`
          );
        } else {
          toast.success(
            `Built ${res.rows.toLocaleString()} rows${configured ? " (preview only)" : " — credentials not configured"}`
          );
        }
        if (res.preview)
          setPreview(JSON.stringify(res.preview[0] ?? {}, null, 2));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Feed failed");
      }
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm">Warehouse feed</CardTitle>
            <CardDescription>
              One wide row per estimate round — every collected field, the
              calculated metric set, and each Region&apos;s custom columns as a
              JSON map so a new column never needs a warehouse schema change.
              Point a scheduler at{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                POST /api/jobs/databricks-sync
              </code>
              .
            </CardDescription>
          </div>
          <Badge variant={configured ? "success" : "outline"}>
            <Database />
            {configured ? "Credentials set" : "Preview mode"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <Fact label="Target table" value={table} mono />
          <Fact
            label="Last run"
            value={
              lastRunLabel ? `${lastRunLabel} · ${state.lastStatus}` : "Never"
            }
          />
          <Fact
            label="Rows last built"
            value={state.lastRowCount.toLocaleString()}
          />
        </div>

        {state.lastError && (
          <Alert variant="warning" className="text-xs">
            <AlertDescription className="text-inherit">
              {state.lastError}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground">
          B&amp;G Connect lookups are currently served by the{" "}
          {connectMode === "rest" ? "live REST facade" : "seeded mirror"} — set{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            CONNECT_MODE=rest
          </code>{" "}
          with an endpoint to switch. This feed is preview-only unless warehouse
          writes are explicitly enabled.
        </p>

        {canRun && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={pending}
              onClick={() => run(true)}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Eye className="size-4" />
              )}
              Preview payload
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={pending || !configured || !writesAllowed}
              onClick={() => run(false)}
              title={
                writesAllowed
                  ? "Push rows to Databricks"
                  : "Blocked — DATABRICKS_ALLOW_WRITE is not true"
              }
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Push to warehouse
            </Button>
          </div>
        )}

        {preview && (
          <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
            {preview}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border p-2.5">
      <p className="font-medium">{label}</p>
      <p
        className={`text-muted-foreground ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
