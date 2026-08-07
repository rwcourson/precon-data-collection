"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveAccessSettings } from "@/actions/access";
import type { AccessSettings } from "@/lib/auth";
import type { Role } from "@/db/schema";

type Pair = { group: string; value: string };

export function AccessSettingsPanel({
  settings,
  mode,
  headers,
  roleLabels,
  regions,
  canEdit,
}: {
  settings: AccessSettings;
  mode: "demo" | "sso";
  headers: { email: string; name: string; groups: string };
  roleLabels: Record<string, string>;
  regions: string[];
  canEdit: boolean;
}) {
  const [roles, setRoles] = useState<Pair[]>(
    Object.entries(settings.groupRoles).map(([group, value]) => ({ group, value })),
  );
  const [regionPairs, setRegionPairs] = useState<Pair[]>(
    Object.entries(settings.groupRegions).map(([group, value]) => ({ group, value })),
  );
  const [defaultRole, setDefaultRole] = useState<string>(settings.defaultRole);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const router = useRouter();

  const touch = () => setDirty(true);

  const save = () =>
    startSave(async () => {
      try {
        await saveAccessSettings({
          groupRoles: Object.fromEntries(
            roles.filter((r) => r.group.trim()).map((r) => [r.group, r.value as Role]),
          ),
          groupRegions: Object.fromEntries(
            regionPairs.filter((r) => r.group.trim()).map((r) => [r.group, r.value]),
          ),
          defaultRole: defaultRole as Role,
        });
        setDirty(false);
        toast.success("Identity mappings saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm">Sign-in</CardTitle>
              <CardDescription>
                The app trusts the identity forwarded by B&amp;G&apos;s authenticating
                proxy rather than holding its own passwords. Set{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-2xs">AUTH_MODE=sso</code>{" "}
                to switch off the demo persona picker.
              </CardDescription>
            </div>
            <Badge variant={mode === "sso" ? "success" : "outline"}>
              <KeyRound />
              {mode === "sso" ? "SSO enforced" : "Demo personas"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            {(["email", "name", "groups"] as const).map((k) => (
              <div key={k} className="rounded-md border p-2.5">
                <p className="font-medium capitalize">{k} header</p>
                <code className="text-2xs text-muted-foreground">{headers[k]}</code>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The proxy must strip these headers from inbound requests. Requests that
            reach the app without an identity header are refused in SSO mode.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Group mapping</CardTitle>
          <CardDescription>
            Role and Region are re-applied from the IdP on every request, so a
            change in Active Directory takes effect immediately. Groups listed
            here can be edited without a deploy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <PairEditor
            title="Group → Role"
            pairs={roles}
            setPairs={(p) => {
              setRoles(p);
              touch();
            }}
            options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))}
            fallback="pcm"
            canEdit={canEdit}
          />

          <PairEditor
            title="Group → Region"
            pairs={regionPairs}
            setPairs={(p) => {
              setRegionPairs(p);
              touch();
            }}
            options={regions.map((r) => ({ value: r, label: r }))}
            fallback={regions[0] ?? ""}
            canEdit={canEdit}
          />

          <div className="flex flex-wrap items-end gap-3 border-t pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Role when no group matches</Label>
              <Select
                items={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))}
                value={defaultRole}
                onValueChange={(v) => {
                  setDefaultRole(String(v));
                  touch();
                }}
                disabled={!canEdit}
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canEdit && (
              <Button className="ml-auto gap-1.5" size="sm" disabled={saving || !dirty} onClick={save}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save mappings
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PairEditor({
  title,
  pairs,
  setPairs,
  options,
  fallback,
  canEdit,
}: {
  title: string;
  pairs: Pair[];
  setPairs: (p: Pair[]) => void;
  options: { value: string; label: string }[];
  fallback: string;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={p.group}
              onChange={(e) =>
                setPairs(pairs.map((q, j) => (i === j ? { ...q, group: e.target.value } : q)))
              }
              placeholder="IdP group name"
              className="h-8 max-w-72 font-mono text-xs"
              disabled={!canEdit}
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Select
              items={options}
              value={p.value}
              onValueChange={(v) =>
                setPairs(pairs.map((q, j) => (i === j ? { ...q, value: String(v) } : q)))
              }
              disabled={!canEdit}
            >
              <SelectTrigger size="sm" className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                onClick={() => setPairs(pairs.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
        {pairs.length === 0 && (
          <p className="text-xs text-muted-foreground">No groups mapped.</p>
        )}
      </div>
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => setPairs([...pairs, { group: "", value: fallback }])}
        >
          <Plus className="size-3" />
          Add group
        </Button>
      )}
    </div>
  );
}
