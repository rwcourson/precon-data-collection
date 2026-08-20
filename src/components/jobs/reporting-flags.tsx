"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateJobFlags } from "@/actions/job-flags";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReportingFlags({
  jobId,
  hppFlag,
  goNoGoFlag,
  ijvBoardFlag,
  hppSuggested,
  canEdit,
}: {
  jobId: number;
  hppFlag: string | null;
  goNoGoFlag: string | null;
  ijvBoardFlag: string | null;
  hppSuggested: boolean;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const update = (patch: {
    hppFlag?: "hpp" | "not_hpp" | null;
    goNoGoFlag?: "go" | "no_go" | "pending" | null;
    ijvBoardFlag?: "ijv" | "not_ijv" | null;
  }) =>
    startTransition(async () => {
      try {
        await updateJobFlags({ jobId, ...patch });
        toast.success("Reporting flag saved");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Flag could not be saved"
        );
      }
    });

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1">
        <p className="text-xs font-medium">
          HPP
          {hppSuggested && !hppFlag && (
            <span className="ml-1 font-normal text-warning-foreground">
              Suggested from estimate value
            </span>
          )}
        </p>
        <Select
          value={hppFlag ?? ""}
          onValueChange={(value) =>
            update({
              hppFlag: value === "hpp" || value === "not_hpp" ? value : null,
            })
          }
          disabled={!canEdit || pending}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select HPP status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hpp">HPP</SelectItem>
            <SelectItem value="not_hpp">Not HPP</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">Go / No-Go</p>
        <Select
          value={goNoGoFlag ?? ""}
          onValueChange={(value) =>
            update({
              goNoGoFlag:
                value === "go" || value === "no_go" || value === "pending"
                  ? value
                  : null,
            })
          }
          disabled={!canEdit || pending}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select review status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending review</SelectItem>
            <SelectItem value="go">Go</SelectItem>
            <SelectItem value="no_go">No-Go</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">IJV board</p>
        <Select
          value={ijvBoardFlag ?? ""}
          onValueChange={(value) =>
            update({
              ijvBoardFlag:
                value === "ijv" || value === "not_ijv" ? value : null,
            })
          }
          disabled={!canEdit || pending}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select IJV status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ijv">On IJV board</SelectItem>
            <SelectItem value="not_ijv">Not IJV</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
