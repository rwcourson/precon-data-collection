import * as React from 'react';

type ChartDataColumn = {
    key: string;
    label: string;
    /** Screen-reader table formatting; visual chart formatting stays independent. */
    format?: (value: unknown, row: Readonly<Record<string, unknown>>, rowIndex: number) => React.ReactNode;
};
/**
 * Optional text-equivalent for a visual. The table is visually hidden but stays
 * available to assistive technology and copy/navigation commands.
 */
type ChartAccessibleData = {
    caption?: string;
    columns: readonly ChartDataColumn[];
    rows: readonly Readonly<Record<string, unknown>>[];
};
type ChartFrameProps = {
    title?: string;
    description?: string;
    className?: string;
    contentClassName?: string;
    /**
     * `"auto"` lets the body size to its content. Charts need a fixed height —
     * Recharts measures its parent on mount — but a panel of form controls or
     * buttons has a natural height, and pinning it leaves dead space below.
     */
    height?: number | string | "auto";
    actions?: React.ReactNode;
    /** Accessible name used when the visible frame intentionally has no title. */
    ariaLabel?: string;
    /** One-sentence takeaway, units, or reading instructions for the visual. */
    accessibleSummary?: string;
    /** Tabular equivalent of the marks for nonvisual reading. */
    accessibleData?: ChartAccessibleData;
    children: React.ReactNode;
};
/**
 * Keeps semantic table layout out of visual flow. Applying `sr-only` directly
 * to a table lets its intrinsic column widths enlarge the document in some
 * browsers even though the table is clipped.
 */
declare function ScreenReaderTable({ children, ...props }: React.ComponentPropsWithoutRef<"table">): React.JSX.Element;
declare function ChartFrame({ title, description, className, contentClassName, height, actions, ariaLabel, accessibleSummary, accessibleData, children, }: ChartFrameProps): React.JSX.Element;
declare function ChartEmpty({ label }: {
    label?: string;
}): React.JSX.Element;
/** Loading placeholder: a muted panel with a soft sheen sweeping across it. */
declare function ChartSkeleton({ className, label, }: {
    className?: string;
    label?: string;
}): React.JSX.Element;

export { type ChartAccessibleData, type ChartDataColumn, ChartEmpty, ChartFrame, type ChartFrameProps, ChartSkeleton, ScreenReaderTable };
