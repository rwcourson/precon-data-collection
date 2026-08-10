import * as React from 'react';

type BarColumnVariant = "clustered-bar" | "stacked-bar" | "percent-bar" | "clustered-column" | "stacked-column" | "percent-column" | "grouped-stacked-bar" | "grouped-stacked-column" | "3d-clustered-bar" | "3d-clustered-column" | "3d-cylinder-bar" | "3d-cylinder-column";
type BarColumnDatum = Record<string, string | number | null | undefined>;
type BarColumnChartProps = {
    data: BarColumnDatum[];
    categoryKey?: string;
    seriesKeys: string[];
    variant?: BarColumnVariant;
    /** Separate stacks rendered side by side for grouped-stacked variants. */
    stackGroups?: string[][];
    showLegend?: boolean;
    xAxisLabel?: string;
    yAxisLabel?: string;
    valueFormatter?: (value: number) => string;
};
/** Normalize positive and negative stacks independently around a zero baseline. */
declare function normalizePercentRows(data: BarColumnDatum[], keys: string[]): BarColumnDatum[];
declare function BarColumnChart({ data, categoryKey, seriesKeys, variant, stackGroups, showLegend, xAxisLabel, yAxisLabel, valueFormatter, }: BarColumnChartProps): React.JSX.Element;

export { BarColumnChart, type BarColumnChartProps, type BarColumnDatum, type BarColumnVariant, normalizePercentRows };
