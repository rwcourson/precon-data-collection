"use client";

import { useLayoutEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  caretAfterSignificant,
  formatNumericInput,
  parseNumericInput,
  significantNumericCount,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export function NumericInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretSig = useRef<number | null>(null);
  const display = formatNumericInput(value);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || caretSig.current == null) return;
    const pos = caretAfterSignificant(display, caretSig.current);
    el.setSelectionRange(pos, pos);
    caretSig.current = null;
  }, [display]);

  return (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className={cn("tabular-nums", className)}
      value={display}
      onChange={(event) => {
        const el = event.target;
        const caret = el.selectionStart ?? el.value.length;
        caretSig.current = significantNumericCount(el.value.slice(0, caret));
        onChange(parseNumericInput(el.value));
      }}
    />
  );
}
