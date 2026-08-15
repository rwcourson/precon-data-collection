import { cn } from "@/lib/utils";

/** Sparkle mark for AI Copilot — sized like the other sidebar icons. */
export function SparkleIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center text-[15px] leading-none",
        className,
      )}
    >
      ✨
    </span>
  );
}
