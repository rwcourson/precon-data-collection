import { cn } from "@/lib/utils";

/** B&G ampersand — fill tracks the interaction accent in light and dark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-primary", className)}
      style={{
        mask: 'url("/bg-symbol.svg") center / contain no-repeat',
        WebkitMask: 'url("/bg-symbol.svg") center / contain no-repeat',
      }}
    />
  );
}
