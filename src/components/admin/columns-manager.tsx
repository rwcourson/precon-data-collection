"use client";

import { ArrowUpRight, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type AddColumnInput,
  addCustomColumn,
  deleteCustomColumn,
} from "@/actions/admin";
import { proposeFieldPromotion } from "@/actions/governance";
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
import { FIELD_DEFS } from "@/lib/fields";

type Col = {
  id: number;
  scope: "company" | "region";
  region: string | null;
  preconDepartment: string | null;
  label: string;
  type: string;
  options: string[] | null;
  createdByName: string;
};

export function ColumnsManager({
  columns,
  role,
  userRegion,
  regions,
  departments,
  canCompany,
  canRegion,
}: {
  columns: Col[];
  role: string;
  userRegion: string | null;
  regions: string[];
  departments: string[];
  canCompany: boolean;
  canRegion: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const companyCols = columns.filter((c) => c.scope === "company");
  const regionCols = columns.filter((c) => c.scope === "region");

  function remove(col: Col) {
    startTransition(async () => {
      try {
        await deleteCustomColumn(col.id);
        toast.success(`Deleted column "${col.label}"`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  const canDeleteRegionCol = (col: Col) =>
    canCompany || (role === "rpd" && col.region === userRegion);

  const canProposePromotion = role === "rpd" || role === "corporate_admin";

  function propose(col: Col) {
    startTransition(async () => {
      try {
        const res = await proposeFieldPromotion(col.id);
        toast.success(
          res.conflictSummary
            ? `Promotion proposed — ${res.conflictSummary}`
            : `Promotion proposed for "${col.label}"`
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Proposal failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4" /> Company-wide columns
              </CardTitle>
              <CardDescription>
                The standard field set every Region reports on —{" "}
                {FIELD_DEFS.length} standard fields plus any Corporate
                additions. Only the Corporate Precon Admin can change this
                scope.
              </CardDescription>
            </div>
            {canCompany && (
              <AddColumnDialog
                scope="company"
                regions={regions}
                departments={departments}
                userRegion={userRegion}
                role={role}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            {FIELD_DEFS.filter((f) => f.tier === "required").length} required +{" "}
            {FIELD_DEFS.filter((f) => f.tier === "optional").length} optional
            standard fields are defined in the governed field dictionary
            (Sections 8–9 of the requirements) and are not deletable here.
          </div>
          {companyCols.length > 0 && (
            <ColumnTable
              cols={companyCols}
              onDelete={canCompany ? remove : undefined}
              pending={pending}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm">
                Region / Precon Dept-specific columns
              </CardTitle>
              <CardDescription>
                RPDs add locally relevant data points for their own Region — no
                Corporate approval needed. These surface everywhere company-wide
                (exports, report builder, Databricks feed) as sparse columns.
              </CardDescription>
            </div>
            {canRegion && (
              <AddColumnDialog
                scope="region"
                regions={regions}
                departments={departments}
                userRegion={userRegion}
                role={role}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {regionCols.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No Region-specific columns yet.
            </p>
          ) : (
            <ColumnTable
              cols={regionCols}
              onDelete={(c) => (canDeleteRegionCol(c) ? remove(c) : undefined)}
              deletableFn={canDeleteRegionCol}
              pending={pending}
              canPropose={canProposePromotion}
              proposeFn={(c) =>
                role === "corporate_admin" || c.region === userRegion
              }
              onPropose={propose}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ColumnTable({
  cols,
  onDelete,
  deletableFn,
  pending,
  canPropose,
  proposeFn,
  onPropose,
}: {
  cols: Col[];
  onDelete?: (c: Col) => void;
  deletableFn?: (c: Col) => boolean;
  pending: boolean;
  canPropose?: boolean;
  proposeFn?: (c: Col) => boolean;
  onPropose?: (c: Col) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Column</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>Created by</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {cols.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">
              {c.label}
              {c.options && (
                <p className="text-xs text-muted-foreground">
                  {c.options.join(" · ")}
                </p>
              )}
            </TableCell>
            <TableCell className="text-sm capitalize">{c.type}</TableCell>
            <TableCell>
              {c.scope === "company" ? (
                <Badge variant="outline">Company-wide</Badge>
              ) : (
                <Badge variant="secondary">
                  {c.region}
                  {c.preconDepartment ? ` / ${c.preconDepartment}` : ""}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-sm">{c.createdByName}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {canPropose &&
                  onPropose &&
                  c.scope === "region" &&
                  (proposeFn ? proposeFn(c) : true) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={pending}
                      onClick={() => onPropose(c)}
                      title="Propose promote to company standard"
                    >
                      <ArrowUpRight className="size-3.5" />
                      Propose promote
                    </Button>
                  )}
                {onDelete && (deletableFn ? deletableFn(c) : true) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => onDelete(c)}
                    aria-label={`Delete ${c.label}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AddColumnDialog({
  scope,
  regions,
  departments,
  userRegion,
  role,
}: {
  scope: "company" | "region";
  regions: string[];
  departments: string[];
  userRegion: string | null;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<AddColumnInput["type"]>("text");
  const [options, setOptions] = useState("");
  const [region, setRegion] = useState(userRegion ?? regions[0] ?? "");
  const [dept, setDept] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const regionLocked = role === "rpd";

  function submit() {
    startTransition(async () => {
      try {
        await addCustomColumn({
          label,
          type,
          options:
            type === "dropdown"
              ? options
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined,
          scope,
          region: scope === "region" ? region : undefined,
          preconDepartment: scope === "region" && dept ? dept : undefined,
        });
        toast.success(
          `Column "${label}" added — it now appears in exports and the report builder`
        );
        setOpen(false);
        setLabel("");
        setOptions("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Add failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant={scope === "company" ? "default" : "outline"}
            className="gap-1"
          />
        }
      >
        <Plus className="size-3.5" /> Add Column
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {scope === "company"
              ? "Add company-wide column"
              : "Add Region-specific column"}
          </DialogTitle>
          <DialogDescription>
            {scope === "company"
              ? "Applies to every Region's data set. Corporate Precon Admin only."
              : "Scoped to one Region/Precon Department. Appears company-wide as a sparse column."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Column label</Label>
            <Input
              placeholder="e.g. River Mile Marker"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data type</Label>
            <Select
              items={[
                { value: "text", label: "Text" },
                { value: "number", label: "Number" },
                { value: "dollars", label: "Dollars" },
                { value: "date", label: "Date" },
                { value: "dropdown", label: "Dropdown" },
              ]}
              value={type}
              onValueChange={(v) =>
                setType((v ?? "text") as AddColumnInput["type"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="dollars">Dollars</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="dropdown">Dropdown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "dropdown" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Options (one per line)</Label>
              <Textarea
                rows={4}
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder={"ISO 5\nISO 6\nISO 7"}
              />
            </div>
          )}
          {scope === "region" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Region</Label>
                <Select
                  value={region}
                  onValueChange={(v) => setRegion(v ?? "")}
                  disabled={regionLocked}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Precon Dept (optional)</Label>
                <Select value={dept} onValueChange={(v) => setDept(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
        <Button
          onClick={submit}
          disabled={pending || !label.trim()}
          className="w-full"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Add Column
        </Button>
      </DialogContent>
    </Dialog>
  );
}
