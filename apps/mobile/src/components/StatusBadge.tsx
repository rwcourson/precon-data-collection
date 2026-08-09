import { Badge } from "./ui/Badge";

const map: Record<string, "success" | "warning" | "info" | "default" | "destructive"> = {
  active: "info",
  upcoming: "default",
  outstanding: "warning",
  submitted: "warning",
  post_bid: "info",
  locked: "success",
  successful: "success",
  unsuccessful: "destructive",
  pending: "default",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge label={status.replace(/_/g, " ")} tone={map[status] ?? "default"} />;
}
