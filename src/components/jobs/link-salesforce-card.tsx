"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { linkJobToSalesforce } from "@/actions/pursuits";

type Candidate = {
  sfId: string;
  jobNumber: string;
  jobName: string;
  region: string;
  marketSector: string | null;
  city: string | null;
  state: string | null;
  createdDate?: string | null;
};

export function LinkSalesforceCard({
  jobId,
  candidates,
}: {
  jobId: number;
  candidates: Candidate[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4 text-amber-700" />
          Unlinked job — candidate Salesforce matches found
        </CardTitle>
        <CardDescription>
          This pursuit was created before a Salesforce Job Number existed. The system
          matched candidates by job name, Region, and similar criteria. Confirming a
          link keeps the full Estimate Round history and associates it with the new
          Job Number. Confirmations are audit-logged.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {candidates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No candidate matches in B&amp;G Connect yet. Candidates appear here
            automatically once a similar job is created in Salesforce.
          </p>
        )}
        {candidates.map((c) => (
          <div
            key={c.sfId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3"
          >
            <div>
              <p className="text-sm font-medium">
                #{c.jobNumber} — {c.jobName}
              </p>
              <p className="text-xs text-muted-foreground">
                {c.region} · {c.marketSector} · {c.city}, {c.state} · Created{" "}
                {c.createdDate ?? "—"}
              </p>
            </div>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await linkJobToSalesforce(jobId, c.sfId);
                    toast.success(`Linked to Salesforce job #${c.jobNumber}`);
                    router.refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Link failed");
                  }
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Confirm Link
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
