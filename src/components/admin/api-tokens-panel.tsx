"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, Plus, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createApiToken, revokeApiToken } from "@/actions/api-tokens";
import { apiTokenScopeSchema, type ApiTokenScope } from "@/domain/contracts";

const ALL_SCOPES = apiTokenScopeSchema.options;

const SCOPE_LABELS: Record<ApiTokenScope, string> = {
  "profile:read": "Read profile",
  "read:pursuits": "Read pursuits",
  "read:reports": "Read reports",
  "read:dashboards": "Read dashboards",
  "read:sheets": "Read sheets",
  "read:notifications": "Read notifications",
  "read:admin": "Read admin",
  "read:trash": "Read trash",
  "write:pursuits": "Write pursuits",
  "write:reports": "Write reports",
  "write:dashboards": "Write dashboards",
  "write:sheets": "Write sheets",
  "write:notifications": "Write notifications",
  "write:admin": "Write admin",
  "write:trash": "Write trash",
  "write:destructive": "Destructive writes",
  "integrate:connect": "Use Connect integration",
  "admin:tokens": "Manage tokens",
};

export type ApiTokenRow = {
  id: number;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export function ApiTokensPanel({ tokens }: { tokens: ApiTokenRow[] }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiTokenScope[]>(["read:pursuits"]);
  const [expiresOn, setExpiresOn] = useState(() =>
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggleScope(scope: ApiTokenScope) {
    setScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope],
    );
  }

  function create() {
    if (!name.trim() || scopes.length === 0) {
      toast.error("Name and at least one scope are required");
      return;
    }
    startTransition(async () => {
      try {
        const res = await createApiToken({
          name: name.trim(),
          scopes,
          expiresAt: new Date(`${expiresOn}T23:59:59.000Z`).toISOString(),
        });
        setPlaintext(res.token);
        setName("");
        toast.success("Token created — copy it now; it won't be shown again");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Create failed");
      }
    });
  }

  function revoke(id: number, tokenName: string) {
    if (!confirm(`Revoke token "${tokenName}"?`)) return;
    startTransition(async () => {
      try {
        await revokeApiToken(id);
        toast.success(`Revoked "${tokenName}"`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Revoke failed");
      }
    });
  }

  async function copyToken() {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed — select the token manually");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="size-4" />
            Create API token
          </CardTitle>
          <CardDescription>
            Scoped tokens for Magnus and integrations. The secret is shown once
            at creation — store it securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Token name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Magnus production"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Scopes</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_SCOPES.map((scope) => (
                <label
                  key={scope}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={scopes.includes(scope)}
                    onCheckedChange={() => toggleScope(scope)}
                  />
                  <span>{SCOPE_LABELS[scope]}</span>
                  <span className="ml-auto font-mono text-2xs text-muted-foreground">
                    {scope}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expires on</Label>
            <Input
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
              required
            />
          </div>
          <Button
            onClick={create}
            disabled={pending || !name.trim() || scopes.length === 0}
            className="gap-1"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Create token
          </Button>

          {plaintext && (
            <div className="tone-warning rounded-md border p-3">
              <p className="text-xs font-medium">
                Copy this token now — it will not be shown again
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">
                  {plaintext}
                </code>
                <Button size="sm" variant="outline" className="gap-1" onClick={copyToken}>
                  <Copy className="size-3" />
                  Copy
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 text-xs"
                onClick={() => setPlaintext(null)}
              >
                Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Active tokens</CardTitle>
          <CardDescription>
            Prefix identifies tokens in logs. Revoked tokens stop working
            immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="pr-4 text-right">Revoke</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No API tokens yet.
                  </TableCell>
                </TableRow>
              )}
              {tokens.map((t) => (
                <TableRow key={t.id} className={t.revokedAt ? "opacity-60" : ""}>
                  <TableCell className="pl-6">
                    <p className="text-sm font-medium">{t.name}</p>
                    {t.revokedAt && (
                      <Badge variant="secondary" size="sm" className="mt-1">
                        Revoked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.tokenPrefix}…</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.scopes.map((s) => (
                        <Badge key={s} variant="outline" size="sm">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.expiresAt ?? "Never"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.lastUsedAt ?? "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {!t.revokedAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => revoke(t.id, t.name)}
                      >
                        <ShieldOff className="size-3" />
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
