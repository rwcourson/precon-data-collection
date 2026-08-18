"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          ) : (
            <Input
              type={col.type === "date" ? "date" : "text"}
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
