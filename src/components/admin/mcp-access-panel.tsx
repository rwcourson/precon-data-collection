"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  adminRevokeMcpConsent,
  setMcpKillSwitch,
  setMcpRoleDefaults,
  setMcpUserOverride,
} from "@/actions/mcp";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/db/schema";
import type { McpAdminConfig } from "@/lib/authorization/mcp-policy";
import type { GrantableMcpScope } from "@/lib/authorization/mcp-scopes";
import { MCP_SCOPE_LABELS } from "@/lib/authorization/mcp-scopes";
import { ROLE_LABELS } from "@/lib/labels";

export type McpOverrideRow = {
  userId: number;
  enabled: boolean | null;
  scopeCeiling: string[] | null;
};

export type McpPerson = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type McpConnectionRow = {
  consentId: string;
  clientName: string;
  userEmail: string | null;
  scopes: string[];
  createdAtLabel: string;
  lastUsedAtLabel: string;
};

const SCOPE_GROUPS: { label: string; scopes: GrantableMcpScope[] }[] = [
  {
    label: "Read",
    scopes: [
      "profile:read",
      "read:pursuits",
      "read:reports",
      "read:dashboards",
      "read:sheets",
    ],
  },
  { label: "Write", scopes: ["write:pursuits"] },
];

export function McpAccessPanel({
  config,
  roles,
  people,
  overrides,
  connections,
}: {
  config: McpAdminConfig;
  roles: readonly Role[];
  people: McpPerson[];
  overrides: McpOverrideRow[];
  connections: McpConnectionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const overrideByUser = useMemo(() => {
    const map = new Map<number, McpOverrideRow>();
    for (const row of overrides) map.set(row.userId, row);
    return map;
  }, [overrides]);

  const selected = people.find((p) => String(p.id) === selectedUserId);
  const selectedOverride = selected
    ? (overrideByUser.get(selected.id) ?? null)
    : null;
  const inherit = selected != null && selectedOverride == null;

  const run = (work: () => Promise<void>, ok: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await work();
        toast.success(ok);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setError(message);
        toast.error(message);
      }
    });
  };

  const toggleScope = (
    current: GrantableMcpScope[],
    scope: GrantableMcpScope,
    on: boolean
  ) =>
    on ? [...new Set([...current, scope])] : current.filter((s) => s !== scope);

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save MCP settings</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Kill switch</CardTitle>
          <CardDescription>
            When off, every MCP request is denied immediately — including
            Corporate Admin — without waiting for tokens to expire.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch
            checked={config.enabled}
            disabled={pending}
            onCheckedChange={(checked) =>
              run(
                () => setMcpKillSwitch(checked),
                checked ? "MCP on" : "MCP off"
              )
            }
            aria-label="Enable MCP access"
          />
          <span className="text-sm">
            {config.enabled ? "MCP is enabled" : "MCP is disabled for everyone"}
          </span>
          {pending ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Role defaults</CardTitle>
          <CardDescription>
            Ceiling per role. Writes stay off until you opt a role in. Clients
            still have to request and consent to each scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Role</TableHead>
                {SCOPE_GROUPS.flatMap((group) =>
                  group.scopes.map((scope) => (
                    <TableHead key={scope} className="text-center text-xs">
                      {MCP_SCOPE_LABELS[scope] ?? scope}
                    </TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => {
                const current = config.roleDefaults[role] ?? [];
                return (
                  <TableRow key={role}>
                    <TableCell className="pl-6 text-sm">
                      {ROLE_LABELS[role]}
                    </TableCell>
                    {SCOPE_GROUPS.flatMap((group) =>
                      group.scopes.map((scope) => (
                        <TableCell key={scope} className="text-center">
                          <Checkbox
                            checked={current.includes(scope)}
                            disabled={pending}
                            aria-label={`${ROLE_LABELS[role]} ${MCP_SCOPE_LABELS[scope]}`}
                            onCheckedChange={(checked) => {
                              const next = {
                                ...config.roleDefaults,
                                [role]: toggleScope(
                                  current,
                                  scope,
                                  Boolean(checked)
                                ),
                              };
                              run(
                                () => setMcpRoleDefaults(next),
                                "Role defaults saved"
                              );
                            }}
                          />
                        </TableCell>
                      ))
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Per-user override</CardTitle>
          <CardDescription>
            Inherit uses the role default. An explicit grant or deny beats the
            role row on the next MCP request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="mcp-user">Person</Label>
              <Select
                value={selectedUserId}
                onValueChange={(value) => setSelectedUserId(value ?? "")}
              >
                <SelectTrigger id="mcp-user" className="w-72">
                  <SelectValue placeholder="Choose someone" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name} · {person.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected ? (
              <Badge variant="outline">
                {inherit
                  ? "Inheriting role default"
                  : selectedOverride?.enabled === false
                    ? "Explicitly disabled"
                    : "Explicit ceiling"}
              </Badge>
            ) : null}
          </div>
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              {overrides.length === 0
                ? "No per-user overrides. Everyone inherits the role defaults."
                : `${overrides.length} override${overrides.length === 1 ? "" : "s"} in effect. Choose a person to edit.`}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      setMcpUserOverride({
                        userId: selected.id,
                        inherit: true,
                        enabled: null,
                        scopeCeiling: null,
                      }),
                    "Override cleared"
                  )
                }
              >
                Inherit role default
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      setMcpUserOverride({
                        userId: selected.id,
                        inherit: false,
                        enabled: false,
                        scopeCeiling: null,
                      }),
                    "User MCP disabled"
                  )
                }
              >
                Disable this user
              </Button>
              {SCOPE_GROUPS.flatMap((group) =>
                group.scopes.map((scope) => {
                  const ceiling = selectedOverride?.scopeCeiling ?? [];
                  return (
                    <label
                      key={scope}
                      className="inline-flex items-center gap-1.5 text-xs"
                    >
                      <Checkbox
                        checked={ceiling.includes(scope)}
                        disabled={pending || inherit}
                        onCheckedChange={(checked) => {
                          const next = toggleScope(
                            ceiling as GrantableMcpScope[],
                            scope,
                            Boolean(checked)
                          );
                          run(
                            () =>
                              setMcpUserOverride({
                                userId: selected.id,
                                inherit: false,
                                enabled: true,
                                scopeCeiling: next,
                              }),
                            "User ceiling saved"
                          );
                        }}
                      />
                      {MCP_SCOPE_LABELS[scope]}
                    </label>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Connected clients</CardTitle>
          <CardDescription>
            Active OAuth consents. Revoke to invalidate that client&apos;s
            access tokens immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {connections.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">
              No AI tools are connected yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Client</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((row) => (
                  <TableRow key={row.consentId}>
                    <TableCell className="pl-6 text-sm">
                      {row.clientName}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.userEmail ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.scopes
                        .map((scope) => MCP_SCOPE_LABELS[scope] ?? scope)
                        .join(", ")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.lastUsedAtLabel}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => adminRevokeMcpConsent(row.consentId),
                            "Client revoked"
                          )
                        }
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
