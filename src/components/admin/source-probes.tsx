"use client";

import { Database, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  probeSmartsheetRead,
  probeWarehouseRead,
} from "@/actions/integrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SourceProbes({
  databricksConfigured,
  smartsheetConfigured,
  writesAllowed,
  canRun,
}: {
  databricksConfigured: boolean;
  smartsheetConfigured: boolean;
  writesAllowed: boolean;
  canRun: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [dbProbe, setDbProbe] = useState<string | null>(null);
  const [ssProbe, setSsProbe] = useState<string | null>(null);

  const runDb = () =>
    startTransition(async () => {
      try {
        const res = await probeWarehouseRead();
        if (!res.configured) {
          toast.error("Databricks credentials not configured");
          return;
        }
        const ok = res.tables.filter((t) => t.ok).length;
        toast.success(`Databricks read: ${ok}/${res.tables.length} tables`);
        setDbProbe(
          res.tables
            .map(
              (t) =>
                `${t.ok ? "✓" : "✗"} ${t.table}${t.rowCount != null ? ` — ${t.rowCount.toLocaleString()} rows` : ""}${t.error ? ` (${t.error})` : ""}`
            )
            .join("\n")
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Probe failed");
      }
    });

  const runSs = () =>
    startTransition(async () => {
      try {
        const res = await probeSmartsheetRead();
        if (!res.configured) {
          toast.error("SMARTSHEET_ACCESS_TOKEN not configured");
          return;
        }
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(`Smartsheet read: ${res.sheets.length} precon sheets`);
        setSsProbe(
          [
            res.userEmail ? `User: ${res.userEmail}` : null,
            ...res.sheets.slice(0, 40).map((s) => `• ${s.name} (${s.id})`),
            res.sheets.length > 40 ? `… +${res.sheets.length - 40} more` : null,
          ]
            .filter(Boolean)
            .join("\n")
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Probe failed");
      }
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm">
                Databricks (read / pull)
              </CardTitle>
              <CardDescription>
                SELECT probes against Destini, Build, and BuildingConnected
                tables. Warehouse writes stay disabled unless{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  DATABRICKS_ALLOW_WRITE=true
                </code>
                .
              </CardDescription>
            </div>
            <Badge variant={databricksConfigured ? "success" : "outline"}>
              <Database />
              {databricksConfigured ? "Credentials set" : "Not configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Writes: {writesAllowed ? "enabled" : "blocked (read-only)"}
          </p>
          {canRun && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={pending || !databricksConfigured}
              onClick={runDb}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Probe tables
            </Button>
          )}
          {dbProbe && (
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap">
              {dbProbe}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm">
                Smartsheet (read / pull)
              </CardTitle>
              <CardDescription>
                Lists precon sheets visible to the API token. Refresh exports
                locally with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  pnpm run smartsheet:pull
                </code>{" "}
                then import into Neon with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  pnpm run db:import-smartsheet
                </code>
                .
              </CardDescription>
            </div>
            <Badge variant={smartsheetConfigured ? "success" : "outline"}>
              <FileSpreadsheet />
              {smartsheetConfigured ? "Token set" : "Not configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {canRun && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={pending || !smartsheetConfigured}
              onClick={runSs}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              List sheets
            </Button>
          )}
          {ssProbe && (
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap">
              {ssProbe}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
