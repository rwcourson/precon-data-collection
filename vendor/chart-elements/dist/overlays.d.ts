import * as React from 'react';

type AnalyticalOverlayDatum = Record<string, string | number | null | undefined>;
type ReferenceLinesChartProps = {
    data?: AnalyticalOverlayDatum[];
    categoryKey?: string;
    valueKey?: string;
    average?: boolean;
    min?: boolean;
    max?: boolean;
    median?: boolean;
    percentile?: number;
    constant?: number;
};
type ErrorBarDatum = {
    date: string;
    value: number;
    /** Symmetric error, or `[lowerError, upperError]`. */
    error: number | [number, number];
};
type CrossFilterGroup = {
    id: string;
    label: string;
    data: AnalyticalOverlayDatum[];
};
type CrossFilterDemoProps = {
    groups?: CrossFilterGroup[];
    selectedId?: string;
    defaultSelectedId?: string;
    onSelectionChange?: (id: string) => void;
};
type DrillLevel = {
    id: string;
    label: string;
    value: number;
    children?: DrillLevel[];
};
/** Linear interpolation quantile over finite values. */
declare function quantile(values: number[], percentile: number): number;
declare function SmallMultiples({ series, }: {
    series?: string[];
}): React.JSX.Element;
declare function TrellisCharts(): React.JSX.Element;
declare function FacetedCharts(): React.JSX.Element;
declare function ReferenceLinesChart({ data, categoryKey, valueKey, average, min, max, median, percentile, constant, }: ReferenceLinesChartProps): React.JSX.Element;
declare function ConstantLine(): React.JSX.Element;
declare function AverageLine(): React.JSX.Element;
declare function MinLine(): React.JSX.Element;
declare function MaxLine(): React.JSX.Element;
declare function MedianLine(): React.JSX.Element;
declare function PercentileLine({ percentile }: {
    percentile?: number;
}): React.JSX.Element;
declare function DynamicReferenceLine(): React.JSX.Element;
declare function XAxisReferenceLine(): React.JSX.Element;
declare function YAxisReferenceLine(): React.JSX.Element;
declare function ErrorBarsOverlay({ data, }: {
    data?: ErrorBarDatum[];
}): React.JSX.Element;
declare function TrendAnalysis(): React.JSX.Element;
declare function ConditionalDataColors(): React.JSX.Element;
declare function DynamicTitle({ title, className, }: {
    title?: string;
    className?: string;
}): React.JSX.Element;
declare function CrossFilterDemo({ groups, selectedId, defaultSelectedId, onSelectionChange, }: CrossFilterDemoProps): React.JSX.Element;
declare function DrillDownDemo({ root, activePath, defaultActivePath, onPathChange, }: {
    root?: DrillLevel;
    activePath?: string[];
    defaultActivePath?: string[];
    onPathChange?: (path: string[]) => void;
}): React.JSX.Element;
declare function VisualTooltipDemo(): React.JSX.Element;

export { type AnalyticalOverlayDatum, AverageLine, ConditionalDataColors, ConstantLine, CrossFilterDemo, type CrossFilterDemoProps, type CrossFilterGroup, DrillDownDemo, type DrillLevel, DynamicReferenceLine, DynamicTitle, type ErrorBarDatum, ErrorBarsOverlay, FacetedCharts, MaxLine, MedianLine, MinLine, PercentileLine, ReferenceLinesChart, type ReferenceLinesChartProps, SmallMultiples, TrellisCharts, TrendAnalysis, VisualTooltipDemo, XAxisReferenceLine, YAxisReferenceLine, quantile };
