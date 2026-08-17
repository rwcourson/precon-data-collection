"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomColumnFields } from "@/components/rounds/custom-column-fields";
import { savePostBidData } from "@/actions/post-bid";
import type { CustomColumn } from "@/db/schema";

export function RegionCustomTab({
  roundId,
  title,
  columns,
  initialCustom,
  canEdit,
  locked,
}: {
  roundId: number;
  title: string;
  columns: CustomColumn[];
  initialCustom: Record<number, string>;
  canEdit: boolean;
  locked: boolean;
}) {
  const [custom, setCustom] = useState(initialCustom);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const disabled = !canEdit || pending;

  function save() {
    startTransition(async () => {
      try {
        const res = await savePostBidData({
          roundId,
          values: {},
          multiValues: {},
          customValues: custom,
        });
        setDirty(false);
        toast.success(
          res.audited > 0
            ? `Saved — ${res.audited} post-lock change${res.audited === 1 ? "" : "s"} recorded in the audit log`
            : "Saved",
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <Card className="border-info-border bg-info-soft/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {title}
          <Badge variant="info" size="sm">
            Region extras
          </Badge>
        </CardTitle>
        <CardDescription>
          These columns are region-specific and never block Approve &amp; Lock.
          Demo labels are marked so they are not mistaken for Bryan&apos;s live set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CustomColumnFields
          columns={columns}
          values={custom}
          disabled={disabled}
          onChange={(columnId, value) => {
            setCustom((current) => ({ ...current, [columnId]: value }));
            setDirty(true);
          }}
        />
        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={pending || !dirty} className="gap-2">
              {pending ? <Loader2 className="size-4 animate-spin" /> : locked ? <Lock className="size-4" /> : <Save className="size-4" />}
              {locked ? "Save Correction (audit-logged)" : dirty ? "Save Changes" : "Saved"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
