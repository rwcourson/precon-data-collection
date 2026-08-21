"use client";

import { KeyRound, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAccessSettings } from "@/actions/access";
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
import type { Role } from "@/db/schema";
import type { AccessSettings } from "@/lib/auth";
import { previewIdentityMapping } from "@/lib/title-mapping-adapter";

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
    Object.entries(settings.groupRoles).map(([group, value]) => ({
      group,
      value,
    }))
  );
  const [regionPairs, setRegionPairs] = useState<Pair[]>(
    Object.entries(settings.groupRegions).map(([group, value]) => ({
      group,
      value,
    }))
  );
  const [titleRoles, setTitleRoles] = useState<Pair[]>(
    Object.entries(settings.titleRoles).map(([group, value]) => ({
      group,
      value,
    }))
  );
  const [managerRoles, setManagerRoles] = useState<Pair[]>(
    Object.entries(settings.managerRoles).map(([group, value]) => ({
      group,
      value,
    }))
  );
  const [emailRoles, setEmailRoles] = useState<Pair[]>(
    Object.entries(settings.emailRoles).map(([group, value]) => ({
      group,
      value,
    }))
  );
  const [emailRegions, setEmailRegions] = useState<Pair[]>(
    Object.entries(settings.emailRegions).map(([group, value]) => ({
      group,
      value,
    }))
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
            roles
              .filter((r) => r.group.trim())
              .map((r) => [r.group, r.value as Role])
          ),
          groupRegions: Object.fromEntries(
            regionPairs
              .filter((r) => r.group.trim())
              .map((r) => [r.group, r.value])
          ),
          titleRoles: Object.fromEntries(
            titleRoles
              .filter((item) => item.group.trim())
              .map((item) => [item.group, item.value as Role])
          ),
          managerRoles: Object.fromEntries(
            managerRoles
              .filter((item) => item.group.trim())
              .map((item) => [item.group, item.value as Role])
          ),
          emailRoles: Object.fromEntries(
            emailRoles
              .filter((item) => item.group.trim())
              .map((item) => [item.group, item.value as Role])
          ),
          emailRegions: Object.fromEntries(
            emailRegions
              .filter((item) => item.group.trim())
              .map((item) => [item.group, item.value])
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
                Production sign-in is Microsoft Entra via Better Auth (no app
                passwords). Set{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  AUTH_MODE=sso
                </code>{" "}
                to require SSO and hide the demo persona picker.
              </CardDescription>
            </div>
            <Badge variant={mode === "sso" ? "success" : "outline"}>
              <KeyRound />
              {mode === "sso" ? "SSO enforced" : "Demo personas"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-md border p-2.5">
              <p className="font-medium">Provider</p>
              <code className="text-xs text-muted-foreground">
                Microsoft Entra ID
              </code>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="font-medium">Callback</p>
              <code className="text-xs text-muted-foreground">
                /api/auth/callback/microsoft
              </code>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Role and region come from Entra group claims mapped below. Configure
            the app registration to emit a{" "}
            <code className="rounded bg-muted px-1 text-xs">groups</code> claim
            (or security group IDs/names matching these keys). Legacy proxy
            header names remain documented for reference:{" "}
            <code className="rounded bg-muted px-1 text-xs">
              {headers.email}
            </code>
            ,{" "}
            <code className="rounded bg-muted px-1 text-xs">
              {headers.name}
            </code>
            ,{" "}
            <code className="rounded bg-muted px-1 text-xs">
              {headers.groups}
            </code>
            .
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
            options={Object.entries(roleLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            fallback="pcm"
            canEdit={canEdit}
          />

          <PairEditor
            title="Governed title → Role"
            pairs={titleRoles}
            setPairs={(pairs) => {
              setTitleRoles(pairs);
              touch();
            }}
            options={Object.entries(roleLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            fallback="pcm"
            canEdit={canEdit}
            keyPlaceholder="Exact job title"
          />

          <PairEditor
            title="Reporting manager email → Role"
            pairs={managerRoles}
            setPairs={(pairs) => {
              setManagerRoles(pairs);
              touch();
            }}
            options={Object.entries(roleLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            fallback="pcm"
            canEdit={canEdit}
            keyPlaceholder="manager@brasfieldgorrie.com"
          />

          <PairEditor
            title="Person email → Role override"
            pairs={emailRoles}
            setPairs={(pairs) => {
              setEmailRoles(pairs);
              touch();
            }}
            options={Object.entries(roleLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            fallback="pcm"
            canEdit={canEdit}
            keyPlaceholder="person@brasfieldgorrie.com"
          />

          <PairEditor
            title="Person email → Region override"
            pairs={emailRegions}
            setPairs={(pairs) => {
              setEmailRegions(pairs);
              touch();
            }}
            options={regions.map((region) => ({
              value: region,
              label: region,
            }))}
            fallback={regions[0] ?? ""}
            canEdit={canEdit}
            keyPlaceholder="person@brasfieldgorrie.com"
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
              <Label className="text-xs font-medium">
                Role when no group matches
              </Label>
              <Select
                items={Object.entries(roleLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
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
              <Button
                className="ml-auto gap-1.5"
                size="sm"
                disabled={saving || !dirty}
                onClick={save}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save mappings
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <IdentityMappingPreview
        access={{
          groupRoles: Object.fromEntries(
            roles
              .filter((r) => r.group.trim())
              .map((r) => [r.group, r.value as Role])
          ),
          groupRegions: Object.fromEntries(
            regionPairs
              .filter((r) => r.group.trim())
              .map((r) => [r.group, r.value])
          ),
          titleRoles: Object.fromEntries(
            titleRoles
              .filter((item) => item.group.trim())
              .map((item) => [item.group, item.value as Role])
          ),
          managerRoles: Object.fromEntries(
            managerRoles
              .filter((item) => item.group.trim())
              .map((item) => [item.group, item.value as Role])
          ),
          emailRoles: Object.fromEntries(
            emailRoles
              .filter((item) => item.group.trim())
              .map((item) => [item.group, item.value as Role])
          ),
          emailRegions: Object.fromEntries(
            emailRegions
              .filter((item) => item.group.trim())
              .map((item) => [item.group, item.value])
          ),
          defaultRole: defaultRole as Role,
        }}
        roleLabels={roleLabels}
      />
    </div>
  );
}

function IdentityMappingPreview({
  access,
  roleLabels,
}: {
  access: AccessSettings;
  roleLabels: Record<string, string>;
}) {
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [groups, setGroups] = useState("");
  const preview = previewIdentityMapping(
    {
      email,
      name: email,
      title,
      managerEmail,
      groups: groups
        .split(",")
        .map((group) => group.trim())
        .filter(Boolean),
    },
    access
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mapping preview</CardTitle>
        <CardDescription>
          Fail-closed title and reporting-chain lookup. Unmapped identities do
          not inherit a default role in production.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="person@brasfieldgorrie.com"
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Preconstruction Manager"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Manager email</Label>
            <Input
              value={managerEmail}
              onChange={(event) => setManagerEmail(event.target.value)}
              placeholder="director@brasfieldgorrie.com"
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entra groups</Label>
            <Input
              value={groups}
              onChange={(event) => setGroups(event.target.value)}
              placeholder="BG-Precon-PCM, BG-Region-Central"
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>
        <p className="text-sm">
          {preview.role ? (
            <>
              Maps to{" "}
              <span className="font-medium">
                {roleLabels[preview.role] ?? preview.role}
              </span>{" "}
              via {preview.source}
              {preview.matchedKey ? ` (${preview.matchedKey})` : ""}.
              {preview.region ? ` Region ${preview.region}.` : ""}
            </>
          ) : (
            <span className="text-muted-foreground">
              Unmapped — production SSO will deny this identity until a title,
              manager, group, or email override matches.
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function PairEditor({
  title,
  pairs,
  setPairs,
  options,
  fallback,
  canEdit,
  keyPlaceholder = "IdP group name",
}: {
  title: string;
  pairs: Pair[];
  setPairs: (p: Pair[]) => void;
  options: { value: string; label: string }[];
  fallback: string;
  canEdit: boolean;
  keyPlaceholder?: string;
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
                setPairs(
                  pairs.map((q, j) =>
                    i === j ? { ...q, group: e.target.value } : q
                  )
                )
              }
              placeholder={keyPlaceholder}
              className="h-8 max-w-72 font-mono text-xs"
              disabled={!canEdit}
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Select
              items={options}
              value={p.value}
              onValueChange={(v) =>
                setPairs(
                  pairs.map((q, j) =>
                    i === j ? { ...q, value: String(v) } : q
                  )
                )
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
