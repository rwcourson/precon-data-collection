import { cn } from "@/lib/utils";

/** Solid B&G ampersand (`bg-ampersand.png`). Never use `bg-symbol.svg`. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-primary", className)}
      style={{
        mask: 'url("/bg-ampersand.png") center / 72% no-repeat',
        WebkitMask: 'url("/bg-ampersand.png") center / 72% no-repeat',
      }}
    />
  );
}
