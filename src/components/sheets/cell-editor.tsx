"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isNumericType } from "@/lib/sheet-format";

export { formatCell, isNumericType } from "@/lib/sheet-format";

/** Raw editable text for a cell — formatted output is not round-trippable. */
function toInputValue(type: string, value: string | number | null): string {
  if (value == null) return "";
  if (type === "date") return String(value).slice(0, 10);
  return String(value);
}

/**
 * In-cell editor. Commits on Enter or blur, abandons on Escape — the muscle
 * memory people bring from Smartsheet.
 */
export function CellEditor({
  type,
  options,
  value,
  onCommit,
  onCancel,
}: {
  type: string;
  options?: string[];
  value: string | number | null;
  onCommit: (next: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => toInputValue(type, value));
  const committed = useRef(false);

  const commit = (next: string) => {
    if (committed.current) return;
    committed.current = true;
    if (next === toInputValue(type, value)) onCancel();
    else void onCommit(next);
  };

  useEffect(() => {
    committed.current = false;
  }, [value]);

  if (type === "checkbox") {
    return (
      <Checkbox
        autoFocus
        checked={String(value) === "true"}
        onCheckedChange={(v) => commit(v ? "true" : "")}
      />
    );
  }

  if (type === "dropdown" && options && options.length > 0) {
    return (
      <Select
        open
        value={draft}
        onValueChange={(next) => commit(next ?? "")}
        onOpenChange={(open) => {
          if (!open && !committed.current) onCancel();
        }}
      >
        <SelectTrigger size="sm" className="h-7 w-full text-[13px]">
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
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      type={type === "date" ? "date" : "text"}
      inputMode={isNumericType(type) ? "decimal" : undefined}
      className="h-7 w-full px-1.5 py-0 text-[13px]"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(draft);
        } else if (e.key === "Escape") {
          e.preventDefault();
          committed.current = true;
          onCancel();
        }
      }}
    />
  );
}
