"use client";

import { Check, ChevronDown, UsersRound } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateRoundStaffAssignment } from "@/actions/round-staffing";
import { Badge, BadgeRemove } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Assignment = {
  id: number;
  stage: string;
  userId: number | null;
  roleLabel: string | null;
};

export function StaffingCard({
  roundId,
  assignments: initial,
  users,
  canEdit,
  estimateLeadName,
}: {
  roundId: number;
  assignments: Assignment[];
  users: { id: number; name: string }[];
  canEdit: boolean;
  estimateLeadName?: string | null;
}) {
  const [assignments, setAssignments] = useState(initial);
  const [stage, setStage] = useState<"concept" | "dd" | "cd">("concept");
  const [pending, startTransition] = useTransition();
  const nameFor = (userId: number | null) =>
    users.find((user) => user.id === userId)?.name ?? "Unassigned";

  const toggle = (userId: number, assigned: boolean) =>
    startTransition(async () => {
      try {
        await updateRoundStaffAssignment({
          roundId,
          stage,
          userId,
          assigned,
        });
        setAssignments((current) =>
          assigned
            ? [
                ...current,
                {
                  id: -Date.now(),
                  stage,
                  userId,
                  roleLabel: null,
                },
              ]
            : current.filter(
                (item) => !(item.stage === stage && item.userId === userId)
              )
        );
        toast.success(assigned ? "Team member added" : "Team member removed");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Staffing could not be updated"
        );
      }
    });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UsersRound className="size-4" />
          Team
        </CardTitle>
        <CardDescription>
          This pricing effort's people. Concept, DD, and CD can differ from the
          next round. Who can see the parent job is set on the job record, not
          here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 text-xs font-medium uppercase text-muted-foreground">
            Lead
          </span>
          {estimateLeadName ? (
            <Badge variant="secondary">{estimateLeadName}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">
              Set on Estimate Data
            </span>
          )}
        </div>
        {(["concept", "dd", "cd"] as const).map((itemStage) => (
          <div key={itemStage} className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 text-xs font-medium uppercase text-muted-foreground">
              {itemStage}
            </span>
            {assignments
              .filter((assignment) => assignment.stage === itemStage)
              .map((assignment) => (
                <Badge
                  key={`${itemStage}:${assignment.userId}`}
                  variant="secondary"
                >
                  {nameFor(assignment.userId)}
                  {canEdit && assignment.userId && (
                    <BadgeRemove
                      label={nameFor(assignment.userId)}
                      onClick={() => {
                        setStage(itemStage);
                        toggle(assignment.userId!, false);
                      }}
                    />
                  )}
                </Badge>
              ))}
            {!assignments.some(
              (assignment) => assignment.stage === itemStage
            ) && <span className="text-xs text-muted-foreground">No team</span>}
          </div>
        ))}
        {canEdit && (
          <div className="flex items-center gap-1.5">
            {(["concept", "dd", "cd"] as const).map((itemStage) => (
              <Button
                key={itemStage}
                size="xs"
                variant={stage === itemStage ? "secondary" : "ghost"}
                onClick={() => setStage(itemStage)}
              >
                {itemStage.toUpperCase()}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="xs" disabled={pending} />
                }
              >
                Add person <ChevronDown className="size-3" />
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-64 w-64 overflow-y-auto p-1.5"
              >
                {users.map((user) => {
                  const selected = assignments.some(
                    (assignment) =>
                      assignment.stage === stage &&
                      assignment.userId === user.id
                  );
                  return (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                      onClick={() => toggle(user.id, !selected)}
                    >
                      <span className="flex-1 truncate">{user.name}</span>
                      {selected && <Check className="size-3 text-primary" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
