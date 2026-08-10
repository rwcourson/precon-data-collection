"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Shield } from "lucide-react";
import type { Role } from "@/db/schema";
import type { PeopleRow } from "@/actions/people";
import { updatePersonRole } from "@/actions/people";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLES: Role[] = [
  "pcm",
  "estimate_lead",
  "admin_jsa",
  "rpd",
  "leadership",
  "corporate_admin",
];

export function PeoplePanel({
  people,
  roleLabels,
  regions,
  canEdit,
  canGrantCorporateAdmin,
}: {
  people: PeopleRow[];
  roleLabels: Record<string, string>;
  regions: string[];
  canEdit: boolean;
  canGrantCorporateAdmin: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.email.toLowerCase().includes(needle) ||
        p.title.toLowerCase().includes(needle) ||
        p.role.includes(needle) ||
        (p.region ?? "").toLowerCase().includes(needle),
    );
  }, [people, q]);

  const save = (userId: number, role: Role, region: string | null) => {
    setPendingId(userId);
    startTransition(async () => {
      try {
        await updatePersonRole({ userId, role, region });
        toast.success("Role updated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">People &amp; roles</p>
          <p className="text-xs text-muted-foreground">
            {people.length} roster users. Super admins always keep Corporate Precon Admin
            and full corporate visibility.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, role…"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[200px]">Role</TableHead>
              <TableHead className="w-[160px]">Region</TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                roleLabels={roleLabels}
                regions={regions}
                canEdit={canEdit}
                canGrantCorporateAdmin={canGrantCorporateAdmin}
                busy={isPending && pendingId === p.id}
                onSave={save}
              />
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No people match “{q}”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PersonRow({
  person,
  roleLabels,
  regions,
  canEdit,
  canGrantCorporateAdmin,
  busy,
  onSave,
}: {
  person: PeopleRow;
  roleLabels: Record<string, string>;
  regions: string[];
  canEdit: boolean;
  canGrantCorporateAdmin: boolean;
  busy: boolean;
  onSave: (userId: number, role: Role, region: string | null) => void;
}) {
  const [role, setRole] = useState<Role>(person.role);
  const [region, setRegion] = useState<string>(person.region ?? "__corp__");
  const locked = person.isSuperAdmin;
  const dirty =
    role !== person.role ||
    (region === "__corp__" ? null : region) !== person.region;

  const roleOptions = ROLES.filter(
    (r) => r !== "corporate_admin" || canGrantCorporateAdmin || person.role === "corporate_admin",
  );

  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="inline-flex items-center gap-1.5">
          {person.name}
          {person.isSuperAdmin && (
            <Badge variant="info" size="sm" className="gap-1">
              <Shield className="size-3" />
              Super
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{person.email}</TableCell>
      <TableCell className="text-xs">{person.title}</TableCell>
      <TableCell>
        {canEdit && !locked ? (
          <Select
            value={role}
            onValueChange={(v) => {
              if (v) setRole(v as Role);
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabels[r] ?? r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm">{roleLabels[person.role] ?? person.role}</span>
        )}
      </TableCell>
      <TableCell>
        {canEdit && !locked ? (
          <Select
            value={region}
            onValueChange={(v) => {
              if (v) setRegion(v);
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__corp__">Corporate (all)</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm">{person.region ?? "Corporate"}</span>
        )}
      </TableCell>
      <TableCell>
        {canEdit && !locked && (
          <Button
            size="sm"
            variant={dirty ? "default" : "outline"}
            disabled={!dirty || busy}
            onClick={() =>
              onSave(person.id, role, region === "__corp__" ? null : region)
            }
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
