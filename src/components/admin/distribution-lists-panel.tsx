"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, Pencil, Plus, Send, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  deleteDistributionList,
  sendDistributionNow,
  upsertDistributionList,
} from "@/actions/distribution";
import { CONSOLIDATED_REGIONAL_PRESET_KEY } from "@/lib/report-presets";

export type DistributionListRow = {
  id: number;
  name: string;
  region: string | null;
  emails: string[];
  cadence: "manual" | "weekly";
  reportKey: string;
  timezone: string;
  lastSentAt: string | null;
};

export function DistributionListsPanel({
  lists,
}: {
  lists: DistributionListRow[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove(id: number, name: string) {
    if (!confirm(`Delete distribution list "${name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteDistributionList(id);
        toast.success(`Deleted "${name}"`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  function sendNow(id: number, name: string) {
    startTransition(async () => {
      try {
        const res = await sendDistributionNow(id);
        toast.success(
          `Queued ${res.outboxIds.length} email(s) for "${name}" via ${res.provider}`,
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Send failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="size-4" />
              Report distribution lists
            </CardTitle>
            <CardDescription>
              Email the consolidated regional bid schedule PDF to stakeholders.
              Weekly lists send once per ISO week; manual lists send only when you
              click Send now.
            </CardDescription>
          </div>
          <ListFormDialog />
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">List</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Cadence</TableHead>
              <TableHead>Last sent</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lists.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  No distribution lists yet. Create one to email report PDFs.
                </TableCell>
              </TableRow>
            )}
            {lists.map((list) => (
              <TableRow key={list.id}>
                <TableCell className="pl-6">
                  <p className="text-sm font-medium">{list.name}</p>
                  <p className="font-mono text-2xs text-muted-foreground">
                    {list.reportKey}
                  </p>
                </TableCell>
                <TableCell className="text-sm">{list.region ?? "All"}</TableCell>
                <TableCell className="max-w-48">
                  <p className="truncate text-xs text-muted-foreground">
                    {list.emails.join(", ")}
                  </p>
                  <Badge variant="secondary" size="sm" className="mt-1">
                    {list.emails.length}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" size="sm" className="capitalize">
                    {list.cadence}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {list.lastSentAt ?? "Never"}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={pending}
                      onClick={() => sendNow(list.id, list.name)}
                    >
                      {pending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Send className="size-3" />
                      )}
                      Send
                    </Button>
                    <ListFormDialog
                      list={list}
                      trigger={
                        <Button size="sm" variant="ghost" disabled={pending}>
                          <Pencil className="size-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={pending}
                      onClick={() => remove(list.id, list.name)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ListFormDialog({
  list,
  trigger,
}: {
  list?: DistributionListRow;
  trigger?: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(list?.name ?? "");
  const [region, setRegion] = useState(list?.region ?? "");
  const [emails, setEmails] = useState(list?.emails.join("\n") ?? "");
  const [cadence, setCadence] = useState<"manual" | "weekly">(
    list?.cadence ?? "manual",
  );
  const [timezone, setTimezone] = useState(
    list?.timezone ?? "America/Chicago",
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setName(list?.name ?? "");
    setRegion(list?.region ?? "");
    setEmails(list?.emails.join("\n") ?? "");
    setCadence(list?.cadence ?? "manual");
    setTimezone(list?.timezone ?? "America/Chicago");
  }

  function submit() {
    const parsedEmails = emails
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name.trim() || parsedEmails.length === 0) {
      toast.error("Name and at least one email are required");
      return;
    }

    startTransition(async () => {
      try {
        await upsertDistributionList({
          id: list?.id,
          name: name.trim(),
          region: region.trim() || null,
          emails: parsedEmails,
          cadence,
          reportKey: list?.reportKey ?? CONSOLIDATED_REGIONAL_PRESET_KEY,
          timezone: timezone.trim() || "America/Chicago",
        });
        toast.success(list ? `Updated "${name}"` : `Created "${name}"`);
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" className="gap-1">
              <Plus className="size-3.5" /> Add list
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {list ? "Edit distribution list" : "New distribution list"}
          </DialogTitle>
          <DialogDescription>
            Recipients receive the consolidated regional bid schedule PDF. Report
            preset: {CONSOLIDATED_REGIONAL_PRESET_KEY}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">List name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Southeast weekly bid schedule"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Region (optional)</Label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Any region"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cadence</Label>
              <Select
                value={cadence}
                onValueChange={(v) =>
                  setCadence((v ?? "manual") as "manual" | "weekly")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Timezone</Label>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Chicago"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recipients (one per line)</Label>
            <Textarea
              rows={4}
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder={"bryan@example.com\nrpd@example.com"}
            />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !name.trim()} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {list ? "Save changes" : "Create list"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
