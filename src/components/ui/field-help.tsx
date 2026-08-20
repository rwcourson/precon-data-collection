"use client";

import { Info } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function FieldHelp({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const openHelp = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn(
              "size-5 shrink-0 rounded-full text-muted-foreground hover:bg-info-soft hover:text-info-foreground",
              className
            )}
            aria-label={`About ${label}`}
            onMouseEnter={openHelp}
            onMouseLeave={scheduleClose}
            onFocus={openHelp}
          />
        }
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="max-w-72 text-xs leading-relaxed"
        onMouseEnter={openHelp}
        onMouseLeave={scheduleClose}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
