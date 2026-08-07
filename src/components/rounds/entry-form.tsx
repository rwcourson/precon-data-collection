"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Info, Loader2, Lock, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, BadgeRemove } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  conditionalHint,
  fieldApplies,
  FIELD_DEFS,
  FIELD_GROUPS,
  isInternalJointVenture,
  isRateOnly,
  SOURCE_LABELS,
  type ConditionContext,
  type FieldDef,
} from "@/lib/fields";
import { savePostBidData } from "@/actions/post-bid";
import type { CustomColumn } from "@/db/schema";

type Props = {
  roundId: number;
  jobNumber: string;
  jobName: string;
  jobLinked: boolean;
  initialValues: Record<string, string>;
  initialMulti: Record<string, string[]>;
  initialCustom: Record<number, string>;
  estimateLeadId: number | null;
  users: { id: number; name: string; role: string }[];
  lists: Record<string, string[]>;
  customCols: CustomColumn[];
  canEdit: boolean;
  locked: boolean;
  missingKeys: string[];
};

export function EntryForm({
  roundId,
  jobNumber,
  jobName,
  jobLinked,
  initialValues,
  initialMulti,
  initialCustom,
  estimateLeadId,
  users,
  lists,
  customCols,
  canEdit,
  locked,
  missingKeys,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [multi, setMulti] = useState(initialMulti);
  const [custom, setCustom] = useState(initialCustom);
  const [leadId, setLeadId] = useState<number | null>(estimateLeadId);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const ctx: ConditionContext = {
    awardability: values.awardability,
    estimatePhase: values.estimatePhase,
    internalJointVenture: values.internalJointVenture,
  };
  const rateOnly = isRateOnly(values.awardability, values.estimatePhase);
  const ijv = isInternalJointVenture(values.internalJointVenture);

  const groups = useMemo(() => {
    const byGroup = new Map<string, FieldDef[]>();
    for (const g of FIELD_GROUPS) byGroup.set(g, []);
    for (const f of FIELD_DEFS) byGroup.get(f.group)!.push(f);
    return [...byGroup.entries()].filter(([, fs]) => fs.length > 0);
  }, []);

  const visibleGroups = groups
    .map(([group, fields]) => [group, fields.filter((f) => fieldApplies(f, ctx))] as const)
    .filter(([, fields]) => fields.length > 0);

  const set = (k: string, v: string) => {
    setValues((s) => {
      const next = { ...s, [k]: v };
      // Conditional fields keep no stale value once their trigger goes away.
      if (k === "awardability" || k === "estimatePhase") {
        if (!isRateOnly(next.awardability, next.estimatePhase)) next.costOfWorkBasis = "";
      }
      return next;
    });
    setDirty(true);
  };

  function save() {
    startTransition(async () => {
      try {
        const res = await savePostBidData({
          roundId,
          values,
          multiValues: multi,
          customValues: custom,
          estimateLeadId: leadId,
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

  const disabled = !canEdit || pending;

  return (
    <div className="space-y-4">
      {ijv && (
        <Alert variant="info" className="text-xs">
          <Info />
          <AlertDescription className="text-inherit">
            <span className="font-medium">Internal Joint Venture</span> — record the
            lead operational Region and lead Preconstruction Department per the DMR,
            not the supporting party. The full estimate value stays on this round so
            it is counted once in Corporate rollups.
          </AlertDescription>
        </Alert>
      )}

      {rateOnly && (
        <Alert variant="accent" className="text-xs">
          <Info />
          <AlertDescription className="text-inherit">
            <span className="font-medium">Rate Only round</span> — Cost of Work Basis
            is shown because fee and GC rates are priced against an estimated future
            construction cost rather than a bid amount.
          </AlertDescription>
        </Alert>
      )}

      {visibleGroups.map(([group, fields]) => (
        <Card key={group}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{group}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => {
              // Job-level identity fields are read-only from the parent job
              if (f.key === "jobNumber")
                return (
                  <ReadOnlyField key={f.key} def={f} value={jobNumber} hint={jobLinked ? "Linked to B&G Connect" : "Placeholder — pending Salesforce match"} />
                );
              if (f.key === "jobName")
                return <ReadOnlyField key={f.key} def={f} value={jobName} />;
              if (f.key === "estimateLead")
                return (
                  <div key={f.key} className="space-y-1">
                    <FieldLabel def={f} missing={missingKeys.includes(f.key)} />
                    <Select
                      value={leadId != null ? String(leadId) : ""}
                      onValueChange={(v) => {
                        setLeadId(v ? Number(v) : null);
                        setDirty(true);
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Assign lead…" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );

              if (f.type === "multi") {
                const selected = multi[f.key] ?? [];
                const options = lists[f.listKey ?? ""] ?? [];
                return (
                  <div key={f.key} className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <FieldLabel def={f} missing={missingKeys.includes(f.key)} />
                    <MultiSelect
                      options={options}
                      selected={selected}
                      disabled={disabled}
                      onChange={(next) => {
                        setMulti((m) => ({ ...m, [f.key]: next }));
                        setDirty(true);
                      }}
                    />
                  </div>
                );
              }

              const hint = conditionalHint(f.key, ctx);

              if (f.type === "dropdown") {
                const options = lists[f.listKey ?? ""] ?? [];
                return (
                  <div key={f.key} className="space-y-1">
                    <FieldLabel def={f} missing={missingKeys.includes(f.key)} />
                    <Select
                      value={values[f.key] ?? ""}
                      onValueChange={(v) => set(f.key, v ?? "")}
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hint && <p className="text-2xs text-info-foreground">{hint}</p>}
                  </div>
                );
              }

              return (
                <div key={f.key} className="space-y-1">
                  <FieldLabel def={f} missing={missingKeys.includes(f.key)} />
                  <div className="relative">
                    {f.type === "dollars" && (
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        $
                      </span>
                    )}
                    <Input
                      type={f.type === "date" ? "date" : "text"}
                      inputMode={f.type === "dollars" || f.type === "number" ? "decimal" : undefined}
                      className={f.type === "dollars" ? "pl-6" : ""}
                      value={values[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      disabled={disabled}
                      placeholder={f.type === "dollars" ? "0" : undefined}
                    />
                  </div>
                  {hint && <p className="text-2xs text-info-foreground">{hint}</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {customCols.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              Region-Specific Columns
              <Badge variant="secondary" size="sm">
                {customCols[0].region}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {customCols.map((col) => (
              <div key={col.id} className="space-y-1">
                <Label className="text-xs font-medium">{col.label}</Label>
                {col.type === "dropdown" ? (
                  <Select
                    value={custom[col.id] ?? ""}
                    onValueChange={(v) => {
                      setCustom((c) => ({ ...c, [col.id]: v ?? "" }));
                      setDirty(true);
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(col.options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={col.type === "date" ? "date" : "text"}
                    value={custom[col.id] ?? ""}
                    onChange={(e) => {
                      setCustom((c) => ({ ...c, [col.id]: e.target.value }));
                      setDirty(true);
                    }}
                    disabled={disabled}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={save} disabled={pending || !dirty} size="lg" className="gap-2 shadow-lg">
            {pending ? <Loader2 className="size-4 animate-spin" /> : locked ? <Lock className="size-4" /> : <Save className="size-4" />}
            {locked ? "Save Correction (audit-logged)" : dirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ def, missing }: { def: FieldDef; missing: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className={`text-xs font-medium ${missing ? "text-destructive" : ""}`}>
        {def.label}
        {def.tier === "required" && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {def.source && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Badge
                variant="outline"
                size="sm"
                className="cursor-default font-normal text-muted-foreground"
              />
            }
          >
            {SOURCE_LABELS[def.source]}
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs">
            Mapped to {SOURCE_LABELS[def.source]}. Manual entry at launch; the data
            model mirrors the source system so a future API connection populates it
            without schema changes.
            {def.note ? ` ${def.note}.` : ""}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function ReadOnlyField({ def, value, hint }: { def: FieldDef; value: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <FieldLabel def={def} missing={false} />
      <Input value={value} disabled className="bg-muted/50" />
      {hint && <p className="text-2xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((s) => (
        <Badge key={s} variant="secondary">
          {s}
          {!disabled && (
            <BadgeRemove label={s} onClick={() => onChange(selected.filter((x) => x !== s))} />
          )}
        </Badge>
      ))}
      {!disabled && (
        <Popover>
          <PopoverTrigger
            render={<Button variant="outline" size="xs" className="gap-1" />}
          >
            Add <ChevronDown className="size-3" />
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-64 w-72 overflow-y-auto p-1.5">
            {options.map((o) => {
              const checked = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
                  onClick={() =>
                    onChange(checked ? selected.filter((x) => x !== o) : [...selected, o])
                  }
                >
                  <Checkbox checked={checked} className="pointer-events-none size-3.5" />
                  {o}
                  {checked && <Check className="ml-auto size-3 text-primary" />}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      )}
      {selected.length === 0 && disabled && (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}
