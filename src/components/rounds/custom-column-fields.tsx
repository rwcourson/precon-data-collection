"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomColumn } from "@/db/schema";

export function CustomColumnFields({
  columns,
  values,
  disabled,
  onChange,
}: {
  columns: CustomColumn[];
  values: Record<number, string>;
  disabled: boolean;
  onChange: (columnId: number, value: string) => void;
}) {
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {columns.map((col) => (
        <div key={col.id} className="space-y-1">
          <Label className="text-xs font-medium">{col.label}</Label>
          {col.type === "dropdown" ? (
            <Select
              value={values[col.id] ?? ""}
              onValueChange={(v) => onChange(col.id, v ?? "")}
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
          ) : col.type === "date" ? (
            <DatePicker
              value={values[col.id] ?? ""}
              onChange={(next) => onChange(col.id, next)}
              disabled={disabled}
            />
          ) : col.type === "dollars" || col.type === "number" ? (
            <div className="relative">
              {col.type === "dollars" ? (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
              ) : null}
              <NumericInput
                className={col.type === "dollars" ? "pl-6" : ""}
                value={values[col.id] ?? ""}
                onChange={(next) => onChange(col.id, next)}
                disabled={disabled}
                placeholder={col.type === "dollars" ? "0" : undefined}
              />
            </div>
          ) : (
            <Input
              type="text"
              value={values[col.id] ?? ""}
              onChange={(e) => onChange(col.id, e.target.value)}
              disabled={disabled}
            />
          )}
        </div>
      ))}
    </div>
  );
}
