"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Search, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  createPursuit,
  searchSalesforceJobs,
  type CreatePursuitInput,
} from "@/actions/pursuits";

type SfJob = {
  sfId: string;
  jobNumber: string;
  jobName: string;
  region: string;
  marketSector: string | null;
  city: string | null;
  state: string | null;
};

export function NewPursuitDialog({
  lists,
}: {
  lists: Record<string, string[]>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"salesforce" | "manual">("salesforce");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SfJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SfJob | null>(null);
  const [manualName, setManualName] = useState("");
  const [form, setForm] = useState<Record<string, string>>({
    initialStatus: "upcoming",
    bidYear: "2026",
  });
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const set = (k: string, v: string | null) => setForm((f) => ({ ...f, [k]: v ?? "" }));

  async function runSearch(q: string) {
    setQuery(q);
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

  function submit() {
    const required = ["region", "preconDepartment", "estimatePhase", "bidYear"];
    for (const k of required) {
      if (!form[k]) {
        toast.error("Region, Precon Department, Estimate Phase, and Bid Year are required");
        return;
      }
    }
    if (mode === "salesforce" && !selected) {
      toast.error("Select a job from Salesforce / Connect, or switch to No job number yet (ROM)");
      return;
    }
    if (mode === "manual" && !manualName.trim()) {
      toast.error("Enter a Job Name for the manual pursuit");
      return;
    }
    const input: CreatePursuitInput = {
      mode,
      sfId: selected?.sfId,
      jobName: manualName,
      region: form.region,
      preconDepartment: form.preconDepartment,
      estimatePhase: form.estimatePhase,
      bidYear: Number(form.bidYear),
      bidDueDate: form.bidDueDate,
      mlt: form.mlt,
      contractType: form.contractType,
      procurement: form.procurement,
      statusAtPricing: form.statusAtPricing,
      initialStatus: form.initialStatus as CreatePursuitInput["initialStatus"],
    };
    startTransition(async () => {
      try {
        await createPursuit(input);
        toast.success(
          mode === "manual"
            ? "ROM created as TBD-… and left unlinked — link to Salesforce when the number arrives"
            : "Pursuit created from Salesforce / Connect",
        );
        setOpen(false);
        setSelected(null);
        setManualName("");
        setQuery("");
        setResults([]);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create pursuit");
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
            Salesforce first — look up the job number in B&amp;G Connect. Use
            No job number yet (ROM) only when Precon is pricing before Salesforce
            has a number. That path stays unlinked as TBD-….
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="salesforce">From Salesforce / Connect</TabsTrigger>
            <TabsTrigger value="manual">No job number yet (ROM)</TabsTrigger>
          </TabsList>

          <TabsContent value="salesforce" className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search Connect by job name or number…"
                className="pl-8"
                value={query}
                onChange={(e) => runSearch(e.target.value)}
              />
              {searching && (
                <Loader2 className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {selected ? (
              <div className="flex items-start justify-between rounded-md border bg-accent/40 p-3">
                <div>
                  <p className="text-sm font-medium">
                    #{selected.jobNumber} — {selected.jobName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selected.region} · {selected.marketSector} · {selected.city},{" "}
                    {selected.state}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  Change
                </Button>
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
                        setForm((f) => ({ ...f, region: r.region }));
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
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-2">
            <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <Unlink className="size-3.5 shrink-0" />
              A placeholder Job Number is assigned. When the job appears in
              Salesforce later, the system suggests candidate matches to link.
            </div>
            <div className="space-y-1.5">
              <Label>Job Name</Label>
              <Input
                placeholder="e.g. Riverside Medical Tower — Quick ROM"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Region *" value={form.region} onChange={(v) => set("region", v)} options={lists.region ?? []} />
          <SelectField label="Precon Department *" value={form.preconDepartment} onChange={(v) => set("preconDepartment", v)} options={lists.preconDepartment ?? []} />
          <SelectField label="Estimate Phase *" value={form.estimatePhase} onChange={(v) => set("estimatePhase", v)} options={lists.estimatePhase ?? []} />
          <SelectField label="Bid Year *" value={form.bidYear} onChange={(v) => set("bidYear", v)} options={lists.bidYear ?? []} />
          <div className="space-y-1.5">
            <Label className="text-xs">Bid Due Date</Label>
            <Input
              type="date"
              value={form.bidDueDate ?? ""}
              onChange={(e) => set("bidDueDate", e.target.value)}
            />
          </div>
          <SelectField label="MLT" value={form.mlt} onChange={(v) => set("mlt", v)} options={lists.mlt ?? []} />
          <SelectField label="Contract Type" value={form.contractType} onChange={(v) => set("contractType", v)} options={lists.contractType ?? []} />
          <SelectField label="Procurement" value={form.procurement} onChange={(v) => set("procurement", v)} options={lists.procurement ?? []} />
          <SelectField label="Status at Pricing" value={form.statusAtPricing} onChange={(v) => set("statusAtPricing", v)} options={lists.statusAtPricing ?? []} />
          <SelectField
            label="Bid Schedule Section"
            value={form.initialStatus}
            onChange={(v) => set("initialStatus", v)}
            options={["active", "upcoming", "outstanding"]}
            labels={{ active: "Active", upcoming: "Upcoming", outstanding: "Outstanding" }}
          />
        </div>

        {mode === "manual" && (
          <Badge variant="warning">
            <Unlink /> Will be created unlinked
          </Badge>
        )}

        <Button onClick={submit} disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Create Pursuit
        </Button>
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
