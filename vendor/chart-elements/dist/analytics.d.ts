import * as React from 'react';

type AnalyticalTreeNode = {
    label: string;
    value: number;
    children?: AnalyticalTreeNode[];
};
type InfluencerDatum = {
    factor: string;
    impact: number;
    direction: "up" | "down";
};
type SegmentDatum = {
    segment: string;
    value: number;
    share: number;
    delta: number;
};
type NarrativeInsight = {
    id: string;
    label: string;
    detail: string;
    tone?: "neutral" | "positive" | "warning" | "negative";
};
type AnomalyDatum = {
    date: string;
    revenue: number;
    anomaly?: boolean;
    expectedLow?: number;
    expectedHigh?: number;
};
type QAChartDatum = Record<string, string | number | null | undefined>;
type QATableRow = {
    id: string;
    region: string;
    revenue: number;
    margin: number;
    orders: number;
};
type QAMapRegion = {
    region: string;
    value: number;
    latitude: number;
    longitude: number;
};
type ForecastPoint = {
    date: string;
    actual: number | null;
    forecast: number | null;
    lower: number | null;
    upper: number | null;
};
declare function DecompositionTree({ root, title, className, }: {
    root?: AnalyticalTreeNode;
    title?: string;
    className?: string;
}): React.JSX.Element;
declare function AIDecompositionTree({ root, title, methodLabel, generatedBy, className, }: {
    root?: AnalyticalTreeNode;
    title?: string;
    /** Name of the documented decomposition method used to create `root`. */
    methodLabel?: string;
    /** Provider or callback name that produced the supplied result. */
    generatedBy?: string;
    className?: string;
}): React.JSX.Element;
declare function KeyInfluencers({ data, title, className, }: {
    data?: InfluencerDatum[];
    title?: string;
    className?: string;
}): React.JSX.Element;
declare function TopSegments({ segments, title, className, }: {
    segments?: SegmentDatum[];
    title?: string;
    className?: string;
}): React.JSX.Element;
declare function SmartNarrative({ title, insights, methodLabel, className, }: {
    title?: string;
    insights?: NarrativeInsight[];
    /** Optional method/provider label for an externally generated result. */
    methodLabel?: string;
    className?: string;
}): React.JSX.Element;
declare function AnomalyDetection({ data, title, methodLabel, className, }: {
    data?: AnomalyDatum[];
    title?: string;
    methodLabel?: string;
    className?: string;
}): React.JSX.Element;
declare function QAVisual({ title, question, defaultQuestion, suggestions, onQuestionChange, onSubmit, className, }: {
    title?: string;
    question?: string;
    defaultQuestion?: string;
    suggestions?: string[];
    onQuestionChange?: (question: string) => void;
    onSubmit?: (question: string) => void | Promise<void>;
    className?: string;
}): React.JSX.Element;
declare function AutoQAChart({ question, data, categoryKey, valueKey, comparisonKey, className, }: {
    question?: string;
    data?: QAChartDatum[];
    categoryKey?: string;
    valueKey?: string;
    comparisonKey?: string | null;
    className?: string;
}): React.JSX.Element;
declare function AutoQATable({ question, rows, className, }: {
    question?: string;
    rows?: QATableRow[];
    className?: string;
}): React.JSX.Element;
declare function AutoQAMap({ regions, question, className, }: {
    regions?: QAMapRegion[];
    question?: string;
    className?: string;
}): React.JSX.Element;
declare function AnomalyOverlayDemo({ data, className, }: {
    data?: AnomalyDatum[];
    className?: string;
}): React.JSX.Element;
declare function ForecastDemo({ data, methodLabel, confidenceLabel, className, }: {
    data?: ForecastPoint[];
    methodLabel?: string;
    confidenceLabel?: string;
    className?: string;
}): React.JSX.Element;

export { AIDecompositionTree, AnomalyDetection, AnomalyOverlayDemo, AutoQAChart, AutoQAMap, AutoQATable, DecompositionTree, ForecastDemo, KeyInfluencers, QAVisual, SmartNarrative, TopSegments };
