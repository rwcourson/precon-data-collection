import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RoundStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/permissions";

const STYLES: Record<RoundStatus, string> = {
  active: "tone-info",
  upcoming: "tone-muted",
  outstanding: "tone-warning",
  submitted: "tone-info",
  post_bid: "tone-warning",
  locked: "tone-success",
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
    pending: "tone-muted",
    successful: "tone-success",
    unsuccessful: "tone-danger",
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
