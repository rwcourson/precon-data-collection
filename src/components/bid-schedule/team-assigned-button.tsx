"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { setTeamAssigned } from "@/actions/staffing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TeamAssignedButton({
  roundId,
  assigned,
  compact = false,
  onAssignedChange,
}: {
  roundId: number;
  assigned: boolean;
  compact?: boolean;
  onAssignedChange?: (assigned: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const shownAssigned = pending ? !assigned : assigned;
  const label = shownAssigned ? "Undo team assigned" : "Mark team assigned";

  const run = () => {
    const next = !assigned;
    onAssignedChange?.(next);
    startTransition(async () => {
      try {
        await setTeamAssigned({ roundId, assigned: next });
        router.refresh();
      } catch (error) {
        onAssignedChange?.(!next);
        toast.error(error instanceof Error ? error.message : "Could not update staffing");
      }
    });
  };

  const icon = pending ? (
    <Loader2 className="size-3.5 animate-spin" />
  ) : shownAssigned ? (
    <UserCheck className="size-3.5" />
  ) : (
    <UserMinus className="size-3.5" />
  );

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        title={label}
        disabled={pending}
        onClick={run}
        className={cn("relative", shownAssigned && "text-success")}
      >
        {icon}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={shownAssigned ? "outline" : "secondary"}
      className="h-7 gap-1.5"
      disabled={pending}
      onClick={run}
    >
      {icon}
      {label}
    </Button>
  );
}
