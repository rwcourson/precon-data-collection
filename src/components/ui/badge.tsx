import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge w-fit shrink-0 inline-flex items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Status colours live here rather than in call sites: the same
        // "approved green" was hand-written in nine files before this.
        success:
          "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
        warning:
          "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
        info: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200",
        accent:
          "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200",
        teal: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-500/40 dark:bg-teal-500/15 dark:text-teal-200",
      },
      size: {
        default:
          "h-5 px-2 py-0.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3!",
        // Dense contexts — counts beside a tab label, tags inside a table cell.
        // 11px is the floor; below that the text stops being readable.
        sm: "h-[1.125rem] px-1.5 text-2xs has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&>svg]:size-2.5!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
      size,
    },
  })
}

/**
 * The dismiss affordance on a removable chip. A bare `<button><X/></button>`
 * inside a badge reads as nothing to a screen reader and cannot be reached by
 * keyboard, so the label and focus ring belong to the control, not the caller.
 */
function BadgeRemove({
  label,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      data-slot="badge-remove"
      className={cn(
        "-mr-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-current/60 transition-colors outline-none hover:bg-black/10 hover:text-current focus-visible:ring-2 focus-visible:ring-ring/40 dark:hover:bg-white/15 [&>svg]:size-3",
        className
      )}
      {...props}
    >
      <XIcon />
    </button>
  )
}

export { Badge, BadgeRemove, badgeVariants }
