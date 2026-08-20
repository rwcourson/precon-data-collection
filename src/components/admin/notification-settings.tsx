"use client";

import { Loader2, Mail, Play, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  runRemindersNow,
  saveNotificationSettings,
} from "@/actions/notifications-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NotificationSettings } from "@/lib/reminders";

export type OutboxRow = {
  id: number;
  toEmail: string;
  subject: string;
  kind: string;
  status: string;
  provider: string;
  createdAt: string;
};

export function NotificationSettingsPanel({
  settings,
  provider,
  pendingCount,
  outbox,
  canEdit,
}: {
  settings: NotificationSettings;
  provider: "resend" | "stub";
  pendingCount: number;
  outbox: OutboxRow[];
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState(settings);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [running, startRun] = useTransition();
  const router = useRouter();

  const patch = (next: Partial<NotificationSettings>) => {
    setDraft((s) => ({ ...s, ...next }));
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Submitted &amp; incomplete reminders
          </CardTitle>
          <CardDescription>
            When a round reaches Submitted with required fields still blank, the
            Estimate Lead is nudged on this cadence, and the Region&apos;s RPD
            is copied once the round is badly overdue. A scheduler calls{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-2xs">
              POST /api/jobs/reminders
            </code>{" "}
            to run the sweep.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cadence</Label>
              <Select
                items={[
                  { value: "off", label: "Off" },
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                ]}
                value={draft.cadence}
                onValueChange={(v) =>
                  patch({
                    cadence: (v ?? "weekly") as NotificationSettings["cadence"],
                  })
                }
                disabled={!canEdit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Grace period (days)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={draft.graceDays}
                onChange={(e) => patch({ graceDays: Number(e.target.value) })}
                disabled={!canEdit}
              />
              <p className="text-2xs text-muted-foreground">
                Days after Submitted before the first nudge.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Escalate to RPD after (days)
              </Label>
              <Input
                type="number"
                min={1}
                max={180}
                value={draft.escalateAfterDays}
                onChange={(e) =>
                  patch({ escalateAfterDays: Number(e.target.value) })
                }
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Channels</Label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={draft.inApp}
                  onCheckedChange={(v) => patch({ inApp: Boolean(v) })}
                  disabled={!canEdit}
                />
                In-app notification
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={draft.email}
                  onCheckedChange={(v) => patch({ email: Boolean(v) })}
                  disabled={!canEdit}
                />
                Email
              </label>
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs font-medium">
              Schedule date-shift recipients
            </Label>
            <p className="text-2xs text-muted-foreground">
              Default is the estimate lead and the home-region RPD/SPD. Channels
              above still apply. The actor who made the change is never
              notified.
            </p>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={draft.dateShiftNotifyLead}
                onCheckedChange={(v) =>
                  patch({ dateShiftNotifyLead: Boolean(v) })
                }
                disabled={!canEdit}
              />
              Estimate lead
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={draft.dateShiftNotifyRegionalRpd}
                onCheckedChange={(v) =>
                  patch({ dateShiftNotifyRegionalRpd: Boolean(v) })
                }
                disabled={!canEdit}
              />
              Regional RPD / SPD
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Badge variant="outline" size="sm" className="gap-1">
              <Mail className="size-3" />
              {provider === "resend"
                ? "Resend configured — messages send for real"
                : "Stub provider — messages are written to the outbox only"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {pendingCount} round{pendingCount === 1 ? "" : "s"} currently past
              the grace period.
            </span>
            <div className="ml-auto flex items-center gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={running}
                  onClick={() =>
                    startRun(async () => {
                      try {
                        const res = await runRemindersNow();
                        toast.success(
                          `Sweep complete — ${res.candidates} overdue round${res.candidates === 1 ? "" : "s"}, ${res.notified} in-app, ${res.emailed} email${res.emailed === 1 ? "" : "s"}.`
                        );
                        router.refresh();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Sweep failed"
                        );
                      }
                    })
                  }
                >
                  {running ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Run now
                </Button>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={saving || !dirty}
                  onClick={() =>
                    startSave(async () => {
                      try {
                        await saveNotificationSettings(draft);
                        setDirty(false);
                        toast.success("Notification settings saved");
                        router.refresh();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Save failed"
                        );
                      }
                    })
                  }
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Outbox (latest 25)</CardTitle>
          <CardDescription>
            Every message the system would send, kept for review while the
            notification channel is still being decided with IT.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">When</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outbox.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    Nothing queued yet. Use Run now to generate the current
                    sweep.
                  </TableCell>
                </TableRow>
              )}
              {outbox.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap pl-6 text-xs">
                    {m.createdAt}
                  </TableCell>
                  <TableCell className="text-xs">{m.toEmail}</TableCell>
                  <TableCell className="max-w-72 truncate text-xs">
                    {m.subject}
                  </TableCell>
                  <TableCell className="text-xs">{m.kind}</TableCell>
                  <TableCell className="pr-4">
                    <Badge
                      size="sm"
                      variant={
                        m.status === "sent"
                          ? "success"
                          : m.status === "failed"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {m.status} · {m.provider}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
