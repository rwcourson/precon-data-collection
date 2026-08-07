"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpCircle, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reviewFieldPromotion } from "@/actions/governance";

export type FieldPromotionRow = {
  id: number;
  status: "proposed" | "rejected" | "promoted";
  columnLabel: string;
  columnKey: string;
  region: string | null;
  conflictSummary: string | null;
  proposedByName: string;
};

const STATUS_VARIANT: Record<
  FieldPromotionRow["status"],
  "warning" | "success" | "secondary"
> = {
  proposed: "warning",
  promoted: "success",
  rejected: "secondary",
};

export function FieldPromotionsPanel({
  promotions,
}: {
  promotions: FieldPromotionRow[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const pendingRows = promotions.filter((p) => p.status === "proposed");

  function review(id: number, decision: "promote" | "reject") {
    startTransition(async () => {
      try {
        await reviewFieldPromotion(id, decision);
        toast.success(
          decision === "promote"
            ? "Column promoted to company-wide"
            : "Promotion rejected",
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Review failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ArrowUpCircle className="size-4" />
          Field promotion queue
        </CardTitle>
        <CardDescription>
          Region-specific columns proposed for company-wide adoption. Corporate
          Precon Admin confirms or rejects each request — promoted columns appear
          in every Region&apos;s exports and report builder.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Column</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Proposed by</TableHead>
              <TableHead>Conflict</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  No field promotions yet. RPDs propose promotion from the Data
                  Columns tab.
                </TableCell>
              </TableRow>
            )}
            {promotions.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="pl-6">
                  <p className="text-sm font-medium">{p.columnLabel}</p>
                  <p className="font-mono text-2xs text-muted-foreground">
                    {p.columnKey}
                  </p>
                </TableCell>
                <TableCell className="text-sm">{p.region ?? "—"}</TableCell>
                <TableCell className="text-sm">{p.proposedByName}</TableCell>
                <TableCell className="max-w-48 text-xs text-muted-foreground">
                  {p.conflictSummary ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[p.status]} size="sm">
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {p.status === "proposed" ? (
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={pending}
                        onClick={() => review(p.id, "promote")}
                      >
                        {pending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <ArrowUpCircle className="size-3" />
                        )}
                        Promote
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => review(p.id, "reject")}
                      >
                        <XCircle className="size-3" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pendingRows.length > 0 && promotions.length > pendingRows.length && (
          <p className="px-6 py-3 text-xs text-muted-foreground">
            {pendingRows.length} pending of {promotions.length} total.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
