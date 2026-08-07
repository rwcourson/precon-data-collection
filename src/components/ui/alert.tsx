import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
        // Tinted callouts. The fill is lighter than the matching Badge variant
        // because it covers far more area at this size.
        success:
          "border-emerald-300 bg-emerald-50 text-emerald-900 *:data-[slot=alert-description]:text-emerald-900/80 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100 dark:*:data-[slot=alert-description]:text-emerald-100/80",
        warning:
          "border-amber-300 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-900/80 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:*:data-[slot=alert-description]:text-amber-100/80",
        info: "border-sky-300 bg-sky-50 text-sky-900 *:data-[slot=alert-description]:text-sky-900/80 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100 dark:*:data-[slot=alert-description]:text-sky-100/80",
        accent:
          "border-violet-300 bg-violet-50 text-violet-900 *:data-[slot=alert-description]:text-violet-900/80 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-100 dark:*:data-[slot=alert-description]:text-violet-100/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
