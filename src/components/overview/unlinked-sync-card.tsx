"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { runSalesforceSync } from "@/actions/salesforce-inbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OverviewQueuePreview } from "@/lib/overview-queues";

export function UnlinkedSyncCard({
  title,
  description,
  href,
  count,
  preview,
  canSync,
}: {
  title: string;
  description: string;
  href: string;
  count: number;
  preview: OverviewQueuePreview[];
  canSync: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="h-full transition-colors hover:bg-info-soft/60">
      <CardHeader className="gap-1.5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <Link href={href} className="group min-w-0 flex-1">
            <CardDescription className="text-[13px] font-medium text-foreground">
              {title}
            </CardDescription>
            <CardTitle className="font-mono text-xl font-medium tabular-nums">{count}</CardTitle>
          </Link>
          <div className="flex items-center gap-1">
            {canSync && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="gap-1"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const result = await runSalesforceSync();
                      toast.success(
                        `Sync finished — ${result.created} new match candidate${
                          result.created === 1 ? "" : "s"
                        }.`,
                      );
                      router.push("/admin?tab=salesforce");
                      router.refresh();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Sync failed");
                    }
                  })
                }
              >
                {pending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Run sync now
              </Button>
            )}
            <Link href={href} className="text-muted-foreground">
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {preview.length > 0 && (
        <CardContent className="pt-0">
          <ul className="space-y-1">
            {preview.map((item) => (
              <li key={item.roundId} className="truncate text-[13px] text-muted-foreground">
                <span className="font-mono">{item.jobNumber}</span>
                {" · "}
                {item.jobName}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
