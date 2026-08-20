"use client";

import { Loader2, Plus, Search, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type CreatePursuitInput,
  createPursuit,
  searchSalesforceJobs,
} from "@/actions/pursuits";
import { showJobInMyRegion } from "@/actions/visibility";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldHelp } from "@/components/ui/field-help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DuplicateMatch } from "@/lib/duplicate-jobs";
import { typeOverSalesforceSuggestion } from "@/lib/salesforce-link";

type SfJob = {
  sfId: string;
  jobNumber: string;
  jobName: string;
  region: string;
  marketSector: string | null;
  city: string | null;
  state: string | null;
};

const PREVIEW_DUPLICATE: DuplicateMatch = {
  jobId: 1,
  jobName: "Auburn Football Perf. Ctr",
  jobNumber: "TBD-1042",
  homeRegion: "Georgia",
  creatorName: "Marcus Webb",
  lastActivityAt: new Date().toISOString(),
  score: 0.86,
  signals: {
    nameScore: 0.9,
    trigramScore: 0.8,
    cityMatch: true,
    stateMatch: true,
    ownerMatch: true,
  },
};

export function NewPursuitDialog({
  lists,
  homeRegion,
  canChooseRegion = false,
  previewDuplicates = false,
}: {
  lists: Record<string, string[]>;
  homeRegion?: string | null;
  canChooseRegion?: boolean;
  previewDuplicates?: boolean;
}) {
  const [open, setOpen] = useState(previewDuplicates);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SfJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SfJob | null>(null);
  const [undoMatch, setUndoMatch] = useState<SfJob | null>(null);
  const [manualName, setManualName] = useState(
    previewDuplicates ? "Auburn Football Performance Center" : ""
  );
  const [form, setForm] = useState<Record<string, string>>({
    initialStatus: "upcoming",
    bidYear: "2026",
    region: homeRegion ?? "",
  });
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>(
    previewDuplicates ? [PREVIEW_DUPLICATE] : []
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const set = (k: string, v: string | null) =>
    setForm((f) => ({ ...f, [k]: v ?? "" }));

  async function runSearch(q: string) {
    setQuery(q);
    setManualName(q);
    if (selected) {
      const override = typeOverSalesforceSuggestion(selected);
      setSelected(override.selected);
      setUndoMatch(override.undo);
    }
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults((await searchSalesforceJobs(q)) as SfJob[]);
    } finally {
      setSearching(false);
    }
  }

  function submit(confirmDuplicate = false) {
    const region = canChooseRegion ? form.region : (homeRegion ?? form.region);
    const required = ["preconDepartment", "estimatePhase", "bidYear"];
    if (canChooseRegion) required.unshift("region");
    for (const k of required) {
      if (!(k === "region" ? region : form[k])) {
        toast.error(
          "Region, Precon Department, Estimate Phase, and Bid Year are required"
        );
        return;
      }
    }
    if (!manualName.trim()) {
      toast.error("Enter a job name. Salesforce can suggest a number later.");
      return;
    }
    const mode: CreatePursuitInput["mode"] = selected ? "salesforce" : "manual";
    const input: CreatePursuitInput = {
      mode,
      sfId: selected?.sfId,
      jobName: manualName,
      region,
      preconDepartment: form.preconDepartment,
      estimatePhase: form.estimatePhase,
      bidYear: Number(form.bidYear),
      city: selected?.city ?? undefined,
      state: selected?.state ?? undefined,
      initialStatus: "upcoming",
      confirmDuplicate,
    };
    startTransition(async () => {
      try {
        const result = await createPursuit(input);
        if (result.kind === "duplicates") {
          setDuplicates(result.matches);
          return;
        }
        toast.success(
          result.kind === "pending"
            ? "Sent to the RPD for approval — it appears in the pending strip"
            : selected
              ? "Pursuit created from Salesforce / Connect"
              : "ROM created with a pending job number — link to Salesforce when the number arrives"
        );
        setOpen(false);
        setSelected(null);
        setUndoMatch(null);
        setManualName("");
        setQuery("");
        setResults([]);
        setDuplicates([]);
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to create pursuit"
        );
      }
    });
  }

  function adopt(jobId: number) {
    startTransition(async () => {
      try {
        await showJobInMyRegion({ jobId });
        toast.success("This job now shows in your region");
        setOpen(false);
        setDuplicates([]);
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not add to your region"
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="size-4" /> New Pursuit
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Pursuit</DialogTitle>
          <DialogDescription>
            Start typing a job name. Salesforce / Connect suggests a match, but
            only its job number is authoritative. Leave the suggestion unused to
            create a ROM with a pending job number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="pursuit-name">Job name</Label>
            <FieldHelp label="Salesforce suggestions">
              Matches appear as you type. Accepting one uses the Salesforce job
              number. Typing over a suggestion unlinks it; use Undo to restore
              the last match.
            </FieldHelp>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              id="pursuit-name"
              placeholder="e.g. Riverside Medical Tower — Quick ROM"
              className="pl-8"
              value={selected ? manualName : query || manualName}
              onChange={(e) => runSearch(e.target.value)}
            />
            {searching && (
              <Loader2 className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {undoMatch && !selected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setSelected(undoMatch);
                setManualName(undoMatch.jobName);
                setUndoMatch(null);
                setResults([]);
              }}
            >
              Undo — restore Salesforce match #{undoMatch.jobNumber}
            </Button>
          )}
        </div>

        {selected ? (
          <div className="space-y-2 rounded-md border bg-accent/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  #{selected.jobNumber} — Salesforce name “{selected.jobName}”
                </p>
                <p className="text-xs text-muted-foreground">
                  Shadow only: {selected.region} · {selected.marketSector} ·{" "}
                  {selected.city}, {selected.state}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUndoMatch(selected);
                  setSelected(null);
                  setQuery(manualName);
                }}
              >
                Unlink
              </Button>
            </div>
          </div>
        ) : (
          results.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
              {results.map((r) => (
                <button
                  key={r.sfId}
                  type="button"
                  className="w-full rounded-sm px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
                  onClick={() => {
                    setSelected(r);
                    setManualName(r.jobName);
                    setUndoMatch(null);
                    setDuplicates([]);
                    setResults([]);
                  }}
                >
                  <p className="text-sm font-medium">
                    #{r.jobNumber} — {r.jobName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.region} · {r.marketSector}
                  </p>
                </button>
              ))}
            </div>
          )
        )}

        <div className="grid grid-cols-2 gap-3">
          {canChooseRegion ? (
            <SelectField
              label="Region *"
              value={form.region}
              onChange={(v) => set("region", v)}
              options={lists.region ?? []}
            />
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Home region</Label>
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {homeRegion ?? (form.region || "Your region")}
              </p>
            </div>
          )}
          <SelectField
            label="Precon Department *"
            value={form.preconDepartment}
            onChange={(v) => set("preconDepartment", v)}
            options={lists.preconDepartment ?? []}
          />
          <SelectField
            label="Estimate Phase *"
            value={form.estimatePhase}
            onChange={(v) => set("estimatePhase", v)}
            options={lists.estimatePhase ?? []}
          />
          <SelectField
            label="Bid Year *"
            value={form.bidYear}
            onChange={(v) => set("bidYear", v)}
            options={lists.bidYear ?? []}
          />
        </div>

        {duplicates.length > 0 && (
          <Alert variant="warning" data-testid="duplicate-warning">
            <AlertTitle>This looks like a job that already exists</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-2">
                {duplicates.map((match) => (
                  <li
                    key={match.jobId}
                    className="rounded-md border bg-background/70 p-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {match.jobName}
                    </p>
                    <p className="text-xs">
                      {match.jobNumber} · {match.homeRegion}
                      {match.creatorName ? ` · ${match.creatorName}` : ""}
                    </p>
                    {match.jobNumber === "Pending approval" ? (
                      <p className="mt-2 text-xs">
                        A matching create is already waiting for RPD approval.
                      </p>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={pending}
                        onClick={() => adopt(match.jobId)}
                      >
                        Show in my region instead
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {!selected && (
          <Badge variant="warning">
            <Unlink /> Will be created with a pending job number
          </Badge>
        )}

        {duplicates.length > 0 ? (
          <Button
            onClick={() => submit(true)}
            disabled={pending}
            variant="outline"
            className="w-full"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create anyway
          </Button>
        ) : (
          <Button
            onClick={() => submit(false)}
            disabled={pending}
            className="w-full"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create Pursuit
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value?: string;
  onChange: (v: string | null) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {labels?.[o] ?? o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
