"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateParentJob } from "@/actions/organization";
import { Button } from "@/components/ui/button";
import { FieldHelp } from "@/components/ui/field-help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ParentJobEditor({
  jobId,
  parentJobId,
  kind,
  childCount,
  canEdit,
}: {
  jobId: number;
  parentJobId: number | null;
  kind: string | null;
  childCount: number;
  canEdit: boolean;
}) {
  const [parent, setParent] = useState(parentJobId ? String(parentJobId) : "");
  const [relKind, setRelKind] = useState(kind ?? "sub_job");
  const [pending, startTransition] = useTransition();

  const save = (nextParent: number | null) =>
    startTransition(async () => {
      try {
        await updateParentJob({
          childJobId: jobId,
          parentJobId: nextParent,
          kind: relKind as "sub_job" | "tenant_improvement",
        });
        toast.success(
          nextParent
            ? "This job is nested under the parent and will not duplicate the board"
            : "Parent job cleared"
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Parent job could not be saved"
        );
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="parent-job-id" className="text-xs">
          Parent job
        </Label>
        <FieldHelp label="sub-jobs and tenant improvements">
          A TI or sub-job stays one job record under its parent. It does not
          create a second board row. Staffing and visibility stay separate.
        </FieldHelp>
      </div>
      {childCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          This job has {childCount} nested job{childCount === 1 ? "" : "s"}.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <Input
          id="parent-job-id"
          inputMode="numeric"
          placeholder="Parent job id"
          className="w-40"
          value={parent}
          disabled={!canEdit || pending}
          onChange={(event) => setParent(event.target.value)}
        />
        <Select
          value={relKind}
          onValueChange={(value) => setRelKind(value ?? "sub_job")}
          disabled={!canEdit || pending}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sub_job">Sub-job</SelectItem>
            <SelectItem value="tenant_improvement">
              Tenant improvement
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={!canEdit || pending}
          onClick={() => save(parent.trim() ? Number(parent) : null)}
        >
          Save
        </Button>
        {parentJobId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit || pending}
            onClick={() => {
              setParent("");
              save(null);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
