"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { transitionStatus } from "@/actions/pursuits";
import type { RoundStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/labels";

export function StatusMenu({
  roundId,
  status,
  allowed,
}: {
  roundId: number;
  status: RoundStatus;
  allowed: RoundStatus[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (allowed.length === 0) return <StatusBadge status={status} />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="group flex items-center gap-1 rounded-md outline-none disabled:opacity-50"
        disabled={pending}
      >
        <StatusBadge status={status} />
        <ChevronDown className="size-3 text-muted-foreground group-hover:text-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">Move to…</div>
        <DropdownMenuSeparator />
        {allowed.map((t) => (
          <DropdownMenuItem
            key={t}
            onClick={() =>
              startTransition(async () => {
                try {
                  await transitionStatus(roundId, t);
                  toast.success(`Moved to ${STATUS_LABELS[t]}`);
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Transition failed");
                }
              })
            }
          >
            {STATUS_LABELS[t]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
