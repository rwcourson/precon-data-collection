"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { DropdownSelectOptions } from "@/components/ui/dropdown-select-options";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dropdownCommitValue,
  dropdownItems,
  dropdownSelectValue,
} from "@/lib/dropdown-none";
import { parseNumericInput } from "@/lib/format";
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
  }, []);

  if (type === "checkbox") {
    return (
      <Checkbox
        autoFocus
        checked={String(value) === "true"}
        onCheckedChange={(v) => commit(v ? "true" : "")}
      />
    );
  }

  if (type === "date") {
    return (
      <DatePicker
        value={draft}
        size="sm"
        defaultOpen
        autoFocus
        className="h-7 w-full px-1.5 py-0 text-sm"
        onChange={(next) => commit(next)}
        onDismiss={() => {
          if (!committed.current) onCancel();
        }}
      />
    );
  }

  if (type === "dropdown" && options && options.length > 0) {
    return (
      <Select
        open
        items={dropdownItems(options)}
        value={dropdownSelectValue(draft, options)}
        onValueChange={(next) => commit(dropdownCommitValue(next))}
        onOpenChange={(open) => {
          if (!open && !committed.current) onCancel();
        }}
      >
        <SelectTrigger size="sm" className="h-7 w-full text-sm">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <DropdownSelectOptions options={options} />
        </SelectContent>
      </Select>
    );
  }

  if (isNumericType(type)) {
    return (
      <NumericInput
        autoFocus
        value={draft}
        className="h-7 w-full px-1.5 py-0 text-sm"
        onChange={setDraft}
        onBlur={() => commit(parseNumericInput(draft))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(parseNumericInput(draft));
          } else if (e.key === "Escape") {
            e.preventDefault();
            committed.current = true;
            onCancel();
          }
        }}
      />
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      type="text"
      className="h-7 w-full px-1.5 py-0 text-sm"
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
