import { cn } from "@/lib/utils";

/** Magnus mark — masks to currentColor so it matches light/dark nav ink. */
export function MagnusIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        mask: 'url("/magnus-symbol.png") center / contain no-repeat',
        WebkitMask: 'url("/magnus-symbol.png") center / contain no-repeat',
      }}
    />
  );
}
