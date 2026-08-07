import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RoundStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/permissions";

const STYLES: Record<RoundStatus, string> = {
  active:
    "bg-sky-500/10 text-sky-800 border-sky-500/20 dark:bg-sky-400/15 dark:text-sky-200 dark:border-sky-400/25",
  upcoming:
    "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:bg-slate-400/15 dark:text-slate-200 dark:border-slate-400/25",
  outstanding:
    "bg-amber-500/10 text-amber-800 border-amber-500/25 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/25",
  submitted:
    "bg-indigo-500/10 text-indigo-800 border-indigo-500/20 dark:bg-indigo-400/15 dark:text-indigo-200 dark:border-indigo-400/25",
  post_bid:
    "bg-orange-500/10 text-orange-800 border-orange-500/25 dark:bg-orange-400/15 dark:text-orange-200 dark:border-orange-400/25",
  locked:
    "bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-400/25",
};

export function StatusBadge({ status, className }: { status: RoundStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function OutcomeBadge({
  outcome,
}: {
  outcome: "pending" | "successful" | "unsuccessful";
}) {
  const styles = {
    pending:
      "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:bg-slate-400/15 dark:text-slate-300 dark:border-slate-400/25",
    successful:
      "bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-400/25",
    unsuccessful:
      "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:bg-rose-400/15 dark:text-rose-200 dark:border-rose-400/25",
  } as const;
  const labels = {
    pending: "Pending",
    successful: "Successful",
    unsuccessful: "Unsuccessful",
  };
  return (
    <Badge variant="outline" className={styles[outcome]}>
      {labels[outcome]}
    </Badge>
  );
}
