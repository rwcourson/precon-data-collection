"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveGroupEditPolicy } from "@/actions/organization";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import type { Role } from "@/db/schema";

const POLICY_ROLES: { value: Role; label: string }[] = [
  { value: "pcm", label: "PCM" },
  { value: "estimate_lead", label: "Estimate Lead" },
  { value: "admin_jsa", label: "Admin / JSA" },
  { value: "rpd", label: "RPD / SPD" },
];

const MODES = [
  { value: "direct", label: "Direct edit" },
  { value: "propose", label: "Propose" },
  { value: "read", label: "Read only" },
] as const;

export type GroupEditPolicyRow = {
  id: number;
  groupId: number;
  role: Role;
  mode: string;
  groupName: string;
  groupRegion: string | null;
};

export function GroupEditPoliciesPanel({
  groups,
  policies,
  canEdit,
}: {
  groups: { id: number; name: string; region: string | null }[];
  policies: GroupEditPolicyRow[];
  canEdit: boolean;
}) {
  const [groupId, setGroupId] = useState(String(groups[0]?.id ?? ""));
  const [role, setRole] = useState<Role>("pcm");
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("propose");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Group edit policy</CardTitle>
        <CardDescription>
          Per-group write mode for published jobs. Leadership stays read-only
          and Corporate Admin stays direct. The most restrictive matching
          membership wins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {policies.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Mode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    {policy.groupRegion
                      ? `${policy.groupRegion} · ${policy.groupName}`
                      : policy.groupName}
                  </TableCell>
                  <TableCell>
                    {POLICY_ROLES.find((item) => item.value === policy.role)
                      ?.label ?? policy.role}
                  </TableCell>
                  <TableCell>
                    {MODES.find((item) => item.value === policy.mode)?.label ??
                      policy.mode}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No overrides yet — PCM proposes; other editors write directly.
          </p>
        )}
        {canEdit ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Organization group</Label>
              <Select
                value={groupId}
                onValueChange={(value) => setGroupId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.region
                        ? `${group.region} · ${group.name}`
                        : group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as Role)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_ROLES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select
                value={mode}
                onValueChange={(value) =>
                  setMode(value as (typeof MODES)[number]["value"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-4">
              <Button
                size="sm"
                disabled={pending || !groupId}
                onClick={() =>
                  start(async () => {
                    try {
                      await saveGroupEditPolicy({
                        groupId: Number(groupId),
                        role,
                        mode,
                      });
                      toast.success("Group edit policy saved");
                      router.refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not save policy"
                      );
                    }
                  })
                }
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save policy
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
