import * as React from 'react';

type LineAreaVariant = "line" | "area" | "stacked-area" | "percent-area" | "spline-area" | "step" | "spline";
type LineAreaDatum = Record<string, string | number | null | undefined>;
type LineAreaChartProps = {
    data: LineAreaDatum[];
    categoryKey?: string;
    seriesKeys: string[];
    variant?: LineAreaVariant;
    showLegend?: boolean;
    xAxisLabel?: string;
    yAxisLabel?: string;
    valueFormatter?: (value: number) => string;
    missingValues?: "gap" | "connect" | "zero";
};
declare function LineAreaChart({ data, categoryKey, seriesKeys, variant, showLegend, xAxisLabel, yAxisLabel, valueFormatter, missingValues, }: LineAreaChartProps): React.JSX.Element;

export { LineAreaChart, type LineAreaChartProps, type LineAreaDatum, type LineAreaVariant };
