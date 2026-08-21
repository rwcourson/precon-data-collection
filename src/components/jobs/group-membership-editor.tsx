"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateJobGroupMembership } from "@/actions/organization";
import { Badge, BadgeRemove } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Group = {
  id: number;
  name: string;
  region: string | null;
};

type ParticipationRole = "lead" | "partner" | "visibility";
type Discipline = "preconstruction" | "operations";

type Membership = {
  groupId: number;
  name: string;
  participationRole: string;
  discipline: string | null;
};

function asRole(value: string): ParticipationRole {
  return value === "lead" || value === "visibility" ? value : "partner";
}

function asDiscipline(value: string | null): Discipline {
  return value === "operations" ? "operations" : "preconstruction";
}

export function GroupMembershipEditor({
  jobId,
  groups,
  initial,
  canEdit,
}: {
  jobId: number;
  groups: Group[];
  initial: Membership[];
  canEdit: boolean;
}) {
  const [memberships, setMemberships] = useState(initial);
  const [pending, startTransition] = useTransition();

  const persist = (
    group: Group,
    next: {
      enabled: boolean;
      participationRole: ParticipationRole;
      discipline: Discipline;
    },
    apply: (current: Membership[]) => Membership[]
  ) =>
    startTransition(async () => {
      try {
        await updateJobGroupMembership({
          jobId,
          groupId: group.id,
          enabled: next.enabled,
          participationRole: next.participationRole,
          discipline: next.discipline,
        });
        setMemberships(apply);
        toast.success(
          next.enabled ? "Group membership saved" : "Group removed"
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Group could not be updated"
        );
      }
    });

  const toggle = (group: Group, enabled: boolean) => {
    const existing = memberships.find((item) => item.groupId === group.id);
    persist(
      group,
      {
        enabled,
        participationRole:
          memberships.length === 0 || (!enabled && memberships.length === 1)
            ? "lead"
            : asRole(existing?.participationRole ?? "partner"),
        discipline: asDiscipline(existing?.discipline ?? "preconstruction"),
      },
      (current) => {
        if (enabled) {
          if (current.some((item) => item.groupId === group.id)) return current;
          return [
            ...current,
            {
              groupId: group.id,
              name: group.name,
              participationRole: current.length === 0 ? "lead" : "partner",
              discipline: "preconstruction",
            },
          ];
        }
        const remaining = current.filter((item) => item.groupId !== group.id);
        if (
          remaining.length > 0 &&
          remaining.every((item) => item.participationRole !== "lead")
        ) {
          return remaining.map((item, index) =>
            index === 0 ? { ...item, participationRole: "lead" } : item
          );
        }
        return remaining;
      }
    );
  };

  const setLead = (membership: Membership) => {
    const group = groups.find(
      (candidate) => candidate.id === membership.groupId
    );
    if (!group || membership.participationRole === "lead") return;
    persist(
      group,
      {
        enabled: true,
        participationRole: "lead",
        discipline: asDiscipline(membership.discipline),
      },
      (current) =>
        current.map((item) => ({
          ...item,
          participationRole:
            item.groupId === membership.groupId
              ? "lead"
              : item.participationRole === "lead"
                ? "partner"
                : item.participationRole,
        }))
    );
  };

  const cycleDiscipline = (membership: Membership) => {
    const group = groups.find(
      (candidate) => candidate.id === membership.groupId
    );
    if (!group) return;
    const discipline: Discipline =
      membership.discipline === "operations" ? "preconstruction" : "operations";
    persist(
      group,
      {
        enabled: true,
        participationRole: asRole(membership.participationRole),
        discipline,
      },
      (current) =>
        current.map((item) =>
          item.groupId === membership.groupId ? { ...item, discipline } : item
        )
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {memberships.map((membership) => (
        <Badge key={membership.groupId} variant="secondary">
          {membership.name}
          {canEdit ? (
            <>
              <button
                type="button"
                className="text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label={`Set ${membership.name} as the lead group`}
                disabled={pending || membership.participationRole === "lead"}
                onClick={() => setLead(membership)}
              >
                · {membership.participationRole}
              </button>
              <button
                type="button"
                className="text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label={`Toggle ${membership.name} between operations and preconstruction`}
                disabled={pending}
                onClick={() => cycleDiscipline(membership)}
              >
                · {asDiscipline(membership.discipline)}
              </button>
            </>
          ) : (
            <span className="text-muted-foreground">
              · {membership.participationRole}
              {membership.discipline ? ` · ${membership.discipline}` : ""}
            </span>
          )}
          {canEdit && (
            <BadgeRemove
              label={membership.name}
              onClick={() => {
                const group = groups.find(
                  (candidate) => candidate.id === membership.groupId
                );
                if (group) toggle(group, false);
              }}
            />
          )}
        </Badge>
      ))}
      {canEdit && (
        <Popover>
          <PopoverTrigger
            render={<Button variant="outline" size="xs" disabled={pending} />}
          >
            Add group <ChevronDown className="size-3" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-h-72 w-80 overflow-y-auto p-1.5"
          >
            {groups.map((group) => {
              const checked = memberships.some(
                (membership) => membership.groupId === group.id
              );
              return (
                <button
                  key={group.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  onClick={() => toggle(group, !checked)}
                >
                  <Checkbox
                    checked={checked}
                    className="pointer-events-none size-3.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{group.name}</span>
                    {group.region && (
                      <span className="text-xs text-muted-foreground">
                        {group.region}
                      </span>
                    )}
                  </span>
                  {checked && <Check className="size-3 text-primary" />}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      )}
      {!memberships.length && (
        <span className="text-xs text-muted-foreground">
          No collaboration groups assigned
        </span>
      )}
      {memberships.length > 1 && (
        <p className="basis-full text-xs text-muted-foreground">
          Multiple groups means this is an IJV-style job. Click the role to keep
          one lead group, and click the discipline to mark operations vs
          preconstruction; it remains a single job.
        </p>
      )}
    </div>
  );
}
