export { ChartAccessibleData, ChartDataColumn, ChartEmpty, ChartFrame, ChartFrameProps, ChartSkeleton, ScreenReaderTable } from './charts/frame.js';
import * as React from 'react';
export { BarColumnChart, BarColumnChartProps, BarColumnDatum, BarColumnVariant, normalizePercentRows } from './charts/bar-column.js';
export { LineAreaChart, LineAreaChartProps, LineAreaDatum, LineAreaVariant } from './charts/line-area.js';
import { salesByRegion, scatterPoints, matrixRows, ohlc, timeSeries, kpiMetrics, waterfallData, stackedSeries } from './sample-data.js';
import 'vega-embed';

type PayloadItem = {
    name?: string;
    value?: number | string;
    color?: string;
    dataKey?: string | number;
    payload?: Record<string, unknown>;
};
declare function ChartTooltip({ active, payload, label, valueFormatter, showTotal, accessibilityLayer, }: {
    active?: boolean;
    payload?: PayloadItem[];
    label?: string | number;
    valueFormatter?: (n: number) => string;
    /** Appends a bold total row — for stacked charts where the sum is the story. */
    showTotal?: boolean;
    /** Passed by Recharts when its keyboard accessibility layer is enabled. */
    accessibilityLayer?: boolean;
}): React.JSX.Element | null;
declare function exactNumber(n: number): string;
/**
 * Legend label renderer. Recharts labels each series with its raw data key,
 * which surfaces as "product"/"grossMargin" in the UI.
 */
declare function legendLabel(value: unknown): string;

type ComboVariant = "line-clustered-column" | "line-stacked-column" | "dual-axis";
type Row = Record<string, string | number>;
declare function ComboChart({ data, categoryKey, barKeys, lineKeys, variant, }: {
    data: Row[];
    categoryKey?: string;
    barKeys: string[];
    lineKeys: string[];
    variant?: ComboVariant;
}): React.JSX.Element;

type WaterfallPoint = {
    name: string;
    value: number;
    type: "increase" | "decrease" | "total";
};
type WaterfallChartProps = {
    data: WaterfallPoint[];
    totalMode?: "absolute" | "computed";
    valueFormatter?: (value: number) => string;
};
type ShapedPoint = WaterfallPoint & {
    base: number;
    display: number;
    color: string;
    runningBefore: number;
    runningAfter: number;
};
/** Pure prefix scan — no mutation after render (React Compiler safe). */
declare function shapeWaterfall(data: WaterfallPoint[], totalMode?: "absolute" | "computed"): ShapedPoint[];
declare function WaterfallChart({ data, totalMode, valueFormatter, }: WaterfallChartProps): React.JSX.Element;

type RibbonDatum = Record<string, string | number | null | undefined>;
type RibbonChartProps = {
    data: RibbonDatum[];
    categoryKey?: string;
    seriesKeys: string[];
    valueFormatter?: (value: number) => string;
    ariaLabel?: string;
};
/**
 * A real ribbon chart ranks each series independently at every category and
 * connects the resulting stacked positions. Series can therefore cross as
 * their rank changes; a conventional stacked area cannot represent that.
 */
declare function RibbonChart({ data, categoryKey, seriesKeys, valueFormatter, ariaLabel, }: RibbonChartProps): React.JSX.Element;

declare function PieDonutChart({ data, nameKey, valueKey, variant, innerLabel, showLabels, showLegend, maxSlices, }: {
    data: Record<string, string | number>[];
    nameKey?: string;
    valueKey?: string;
    variant?: "pie" | "donut";
    innerLabel?: string;
    /** Callout labels with leader lines, naming each slice and its share. */
    showLabels?: boolean;
    /** Defaults to the opposite of `showLabels`: showing both repeats every category. */
    showLegend?: boolean;
    /** Slices beyond this are pooled into a neutral "Others" wedge. */
    maxSlices?: number;
}): React.JSX.Element;

type FunnelDatum = Record<string, string | number | null | undefined>;
type FunnelChartProps = {
    data: FunnelDatum[];
    nameKey?: string;
    valueKey?: string;
    variant?: "funnel" | "pyramid";
    valueFormatter?: (value: number) => string;
    ariaLabel?: string;
};
declare function FunnelChart({ data, nameKey, valueKey, variant, valueFormatter, ariaLabel, }: FunnelChartProps): React.JSX.Element;

type TreemapNode = {
    id?: string;
    name: string;
    value?: number;
    /** `size` is retained as a source-copy compatibility alias for `value`. */
    size?: number;
    children?: readonly TreemapNode[];
};
type TreemapSelectionEvent = {
    id: string;
    node: TreemapNode;
    path: readonly string[];
    value: number;
};
type TreemapChartProps = {
    data: readonly TreemapNode[];
    className?: string;
    ariaLabel?: string;
    activeId?: string | null;
    defaultActiveId?: string | null;
    onActiveChange?: (id: string | null) => void;
    selectedId?: string | null;
    defaultSelectedId?: string | null;
    onSelectionChange?: (event: TreemapSelectionEvent | null) => void;
    valueFormatter?: (value: number) => string;
    palette?: readonly string[];
};
declare function TreemapChart({ data, className, ariaLabel, activeId, defaultActiveId, onActiveChange, selectedId, defaultSelectedId, onSelectionChange, valueFormatter, palette, }: TreemapChartProps): React.JSX.Element;

type ScatterBubbleDatum = Record<string, string | number | null | undefined>;
type ScatterBubbleChartProps = {
    data: ScatterBubbleDatum[];
    variant?: "scatter" | "bubble" | "dot-plot" | "quadrant";
    xKey?: string;
    yKey?: string;
    zKey?: string;
    categoryKey?: string;
    xThreshold?: number;
    yThreshold?: number;
    quadrantLabels?: [string, string, string, string];
    showLegend?: boolean;
    xAxisLabel?: string;
    yAxisLabel?: string;
};
declare function ScatterBubbleChart({ data, variant, xKey, yKey, zKey, categoryKey, xThreshold, yThreshold, quadrantLabels, showLegend, xAxisLabel, yAxisLabel, }: ScatterBubbleChartProps): React.JSX.Element;

declare function LineSparkline({ data, dataKey, }: {
    data?: Record<string, number>[];
    dataKey?: string;
}): React.JSX.Element;
declare function ColumnSparkline({ data, dataKey, }: {
    data?: Record<string, number>[];
    dataKey?: string;
}): React.JSX.Element;
declare function DataBar({ value, }: {
    value?: number;
}): React.JSX.Element;

type HistogramBin = {
    name: string;
    count: number;
    x0: number;
    x1: number;
};
declare const defaultHist: HistogramBin[];
declare const defaultKde: {
    x: number;
    density: number;
}[];
type KdePoint = {
    x: number;
    density: number;
};
type DistributionGroup = {
    name: string;
    values: number[];
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
};
declare const defaultBox: {
    name: string;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
}[];
declare const defaultCorr: {
    x: string;
    y: string;
    value: number;
}[];
declare const defaultConfusion: {
    actual: string;
    predicted: string;
    count: number;
}[];
declare const defaultFeatures: {
    feature: string;
    importance: number;
}[];
declare const defaultSurvival: {
    t: number;
    survival: number;
}[];
declare const defaultRoc: {
    fpr: number;
    tpr: number;
}[];
declare const defaultPr: {
    recall: number;
    precision: number;
}[];
declare const defaultResiduals: {
    x: number;
    residual: number;
}[];
declare const defaultRegression: {
    x: number;
    y: number;
    z: number;
    category: string;
    name: string;
}[];
type RegressionPoint = {
    x: number;
    y: number;
};
type LinearRegressionResult = {
    slope: number;
    intercept: number;
    rSquared: number;
};
declare function linearRegression(data: readonly RegressionPoint[]): LinearRegressionResult | null;
/** Acklam's deterministic approximation of the standard-normal quantile. */
declare function standardNormalQuantile(probability: number): number;
declare const defaultNetwork: {
    nodes: {
        id: string;
        x: number;
        y: number;
    }[];
    links: {
        source: string;
        target: string;
    }[];
};
declare const defaultErrorBars: {
    name: string;
    value: number;
    error: number;
}[];
declare const defaultPca: {
    pc1: number;
    pc2: number;
    cluster: string;
}[];
declare const defaultRidgeline: {
    name: string;
    points: KdePoint[];
}[];
declare function Histogram({ data }: {
    data?: typeof defaultHist;
}): React.JSX.Element;
declare function DensityPlot({ data }: {
    data?: typeof defaultKde;
}): React.JSX.Element;
declare function KernelDensityPlot({ values }: {
    values?: number[];
}): React.JSX.Element;
declare function BoxPlot({ data }: {
    data?: typeof defaultBox;
}): React.JSX.Element;
declare function ViolinPlot({ groups }: {
    groups?: DistributionGroup[];
}): React.JSX.Element;
declare function RidgelinePlot({ series }: {
    series?: typeof defaultRidgeline;
}): React.JSX.Element;
declare function HexbinPlot({ points }: {
    points?: typeof scatterPoints;
}): React.JSX.Element;
declare function Correlogram({ cells }: {
    cells?: typeof defaultCorr;
}): React.JSX.Element;
declare function ScatterplotMatrix({ variables, data }: {
    variables?: readonly string[];
    data?: typeof scatterPoints;
}): React.JSX.Element;
declare function StatisticalHeatmap({ rows }: {
    rows?: typeof matrixRows;
}): React.JSX.Element;
type TreeDatum$1 = {
    name?: string;
    height?: number;
    children?: TreeDatum$1[];
};
declare function Dendrogram({ tree }: {
    tree?: TreeDatum$1;
}): React.JSX.Element;
declare function SurvivalCurve({ data }: {
    data?: typeof defaultSurvival;
}): React.JSX.Element;
declare function ROCCurve({ data }: {
    data?: typeof defaultRoc;
}): React.JSX.Element;
declare function PrecisionRecallCurve({ data }: {
    data?: typeof defaultPr;
}): React.JSX.Element;
declare function QQPlot({ data }: {
    data?: number[];
}): React.JSX.Element;
declare function ResidualPlot({ data }: {
    data?: typeof defaultResiduals;
}): React.JSX.Element;
declare function RegressionPlot({ data }: {
    data?: typeof defaultRegression;
}): React.JSX.Element;
type ContourGrid = {
    columns: number;
    rows: number;
    values: readonly number[];
};
type ContourPlotProps = {
    grid?: ContourGrid;
    thresholds?: number | readonly number[];
    ariaLabel?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
};
declare function ContourPlot({ grid, thresholds, ariaLabel, xAxisLabel, yAxisLabel, }: ContourPlotProps): React.JSX.Element;
type ConfidenceBandDatum = {
    category: string;
    value: number;
    lower: number;
    upper: number;
};
type ConfidenceBandPlotProps = {
    data?: readonly ConfidenceBandDatum[];
    ariaLabel?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    valueFormatter?: (value: number) => string;
};
declare function ConfidenceBandPlot({ data, ariaLabel, xAxisLabel, yAxisLabel, valueFormatter, }: ConfidenceBandPlotProps): React.JSX.Element;
declare function NetworkPlot({ network }: {
    network?: typeof defaultNetwork;
}): React.JSX.Element;
declare function ErrorBarPlot({ data }: {
    data?: typeof defaultErrorBars;
}): React.JSX.Element;
declare function PairPlot({ data }: {
    data?: typeof scatterPoints;
}): React.JSX.Element;
declare function ConfusionMatrix({ cells }: {
    cells?: typeof defaultConfusion;
}): React.JSX.Element;
type RiskMatrixDatum = {
    id: string;
    label: string;
    likelihood: number;
    impact: number;
};
type RiskMatrixProps = {
    data?: RiskMatrixDatum[];
    likelihoodLabel?: string;
    impactLabel?: string;
};
/** Conventional likelihood-by-impact risk matrix, distinct from classification confusion matrices. */
declare function RiskMatrix({ data, likelihoodLabel, impactLabel, }: RiskMatrixProps): React.JSX.Element;
declare function FeatureImportanceChart({ data }: {
    data?: typeof defaultFeatures;
}): React.JSX.Element;
declare function PCAPlot({ data }: {
    data?: typeof defaultPca;
}): React.JSX.Element;
declare function ClusterPlot({ data }: {
    data?: typeof defaultPca;
}): React.JSX.Element;
declare function BeeswarmPlot({ values }: {
    values?: number[];
}): React.JSX.Element;
declare function StripPlot({ values }: {
    values?: number[];
}): React.JSX.Element;
declare function JitterPlot({ data }: {
    data?: typeof scatterPoints;
}): React.JSX.Element;
declare function RaincloudPlot({ values }: {
    values?: number[];
}): React.JSX.Element;
declare function FrequencyPolygon({ data }: {
    data?: typeof defaultHist;
}): React.JSX.Element;
declare function DotDensityChart({ count }: {
    count?: number;
}): React.JSX.Element;
declare function FacetedPlot({ regions }: {
    regions?: typeof salesByRegion;
}): React.JSX.Element;

/**
 * Pure validation and layout helpers for the flow / network / hierarchy
 * components. Keeping this module free of React makes the public data contract
 * usable in tests, server-side preprocessing, and non-visual tooling.
 */
type ValidationResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    message: string;
};
type SankeyNodeDatum = {
    /** Stable link target. Falls back to `name` when omitted. */
    id?: string;
    name: string;
    /** Optional capacity. Link totals still determine the minimum rendered size. */
    value?: number;
    color?: string;
};
type SankeyLinkDatum = {
    /** A node id/name or a zero-based node index. */
    source: string | number;
    /** A node id/name or a zero-based node index. */
    target: string | number;
    value: number;
    label?: string;
    color?: string;
};
type SankeyLayoutNode = {
    id: string;
    name: string;
    index: number;
    layer: number;
    value: number;
    incomingValue: number;
    outgoingValue: number;
    color?: string;
    x0: number;
    x1: number;
    y0: number;
    y1: number;
};
type SankeyLayoutLink = {
    id: string;
    source: SankeyLayoutNode;
    target: SankeyLayoutNode;
    value: number;
    label?: string;
    color?: string;
    sourceY: number;
    targetY: number;
    thickness: number;
};
type SankeyLayout = {
    width: number;
    height: number;
    nodes: readonly SankeyLayoutNode[];
    links: readonly SankeyLayoutLink[];
};
/**
 * Produces a left-to-right, value-conserving Sankey layout. Node height is the
 * maximum of incoming flow, outgoing flow, and declared capacity. Each link is
 * stacked within both endpoint nodes at exactly one shared value scale.
 */
declare function buildSankeyLayout(inputNodes: readonly SankeyNodeDatum[], inputLinks: readonly SankeyLinkDatum[], options?: {
    width?: number;
    height?: number;
    nodeWidth?: number;
    paddingX?: number;
    paddingY?: number;
}): ValidationResult<SankeyLayout>;
type ChordDatum = {
    id: string;
    label: string;
    color?: string;
};
type ChordInput = {
    groups: readonly ChordDatum[];
    matrix: readonly (readonly number[])[];
};
declare function validateChordInput(groups: readonly ChordDatum[], matrix: readonly (readonly number[])[]): ValidationResult<ChordInput>;
type NetworkNodeDatum = {
    id: string;
    label?: string;
    group?: string | number;
    value?: number;
    /** Optional initial coordinates in the chart's 400×240 viewBox. */
    x?: number;
    y?: number;
    color?: string;
};
type NetworkLinkDatum = {
    source: string;
    target: string;
    value?: number;
    label?: string;
};
type ResolvedNetworkNode = NetworkNodeDatum & {
    id: string;
    label: string;
    group: string | number;
    value: number;
};
type ResolvedNetworkLink = NetworkLinkDatum & {
    source: string;
    target: string;
    value: number;
};
declare function validateNetworkInput(inputNodes: readonly NetworkNodeDatum[], inputLinks: readonly NetworkLinkDatum[]): ValidationResult<{
    nodes: readonly ResolvedNetworkNode[];
    links: readonly ResolvedNetworkLink[];
}>;
type ProcessFlowStepDatum = {
    id: string;
    label: string;
    /** Optional authored coordinates. Supply both x and y for every step. */
    x?: number;
    y?: number;
    color?: string;
};
type ProcessFlowLinkDatum = {
    source: string;
    target: string;
    label?: string;
};
type PositionedProcessStep = ProcessFlowStepDatum & {
    cx: number;
    cy: number;
};
type ProcessFlowLayout = {
    width: number;
    height: number;
    steps: readonly PositionedProcessStep[];
    links: readonly ProcessFlowLinkDatum[];
};
declare function layoutProcessFlow(inputSteps: readonly ProcessFlowStepDatum[], inputLinks: readonly ProcessFlowLinkDatum[] | undefined, options?: {
    width?: number;
    height?: number;
    nodeWidth?: number;
    nodeHeight?: number;
    padding?: number;
}): ValidationResult<ProcessFlowLayout>;
type TreeDatum = {
    id?: string;
    name: string;
    /** Own contribution. Leaf nodes without a value default to one. */
    value?: number;
    children?: readonly TreeDatum[];
};
declare function validateTreeInput(data: TreeDatum): ValidationResult<TreeDatum>;

type FlowHierarchyChartProps = {
    className?: string;
    title?: string;
    description?: string;
};
type SankeyDiagramProps = FlowHierarchyChartProps & {
    nodes?: readonly SankeyNodeDatum[];
    links?: readonly SankeyLinkDatum[];
};
type AlluvialDiagramProps = SankeyDiagramProps;
type ChordDiagramProps = FlowHierarchyChartProps & {
    groups?: readonly ChordDatum[];
    matrix?: readonly (readonly number[])[];
};
type NetworkDiagramProps = FlowHierarchyChartProps & {
    nodes?: readonly NetworkNodeDatum[];
    links?: readonly NetworkLinkDatum[];
};
type ForceDirectedNetworkProps = NetworkDiagramProps & {
    staticLayout?: boolean;
};
type DependencyNodeDatum = NetworkNodeDatum & {
    x: number;
    y: number;
};
type DependencyLinkDatum = NetworkLinkDatum;
type DependencyGraphProps = FlowHierarchyChartProps & {
    nodes?: readonly DependencyNodeDatum[];
    links?: readonly DependencyLinkDatum[];
};
type ProcessFlowProps = FlowHierarchyChartProps & {
    steps?: readonly ProcessFlowStepDatum[];
    /** Omit to connect each step to the next; pass an array for branches. */
    links?: readonly ProcessFlowLinkDatum[];
};
type TreeChartProps = FlowHierarchyChartProps & {
    data?: TreeDatum;
};
type OrgChartProps = TreeChartProps;
type DecisionTreeProps = TreeChartProps;
type TreeDiagramProps = TreeChartProps;
type SunburstChartProps = TreeChartProps;
type IcicleChartProps = TreeChartProps;
type CirclePackingProps = TreeChartProps;
type JourneyDatum = {
    id?: string;
    stage: string;
    /** Percentage score from zero through one hundred. */
    score: number;
};
type JourneyMapProps = FlowHierarchyChartProps & {
    stages?: readonly JourneyDatum[];
};
type HierarchicalEdgeLinkDatum = {
    /** Leaf id, or a unique leaf name when ids are omitted. */
    source: string;
    /** Leaf id, or a unique leaf name when ids are omitted. */
    target: string;
    value?: number;
    label?: string;
};
type HierarchicalEdgeBundlingProps = TreeChartProps & {
    links?: readonly HierarchicalEdgeLinkDatum[];
};
declare function SankeyDiagram({ nodes, links, ...props }?: SankeyDiagramProps): React.JSX.Element;
declare function AlluvialDiagram({ nodes, links, ...props }?: AlluvialDiagramProps): React.JSX.Element;
declare function ChordDiagram({ groups, matrix, title, description, className, }?: ChordDiagramProps): React.JSX.Element;
declare function NetworkDiagram(props?: NetworkDiagramProps): React.JSX.Element;
declare function ForceDirectedNetwork({ nodes, links, staticLayout, title, description, className, }?: ForceDirectedNetworkProps): React.JSX.Element;
declare function DependencyGraph({ nodes, links, title, description, className, }?: DependencyGraphProps): React.JSX.Element;
declare function OrgChart({ data, title, ...props }?: OrgChartProps): React.JSX.Element;
declare function DecisionTree({ data, title, ...props }?: DecisionTreeProps): React.JSX.Element;
declare function TreeDiagram({ data, title, ...props }?: TreeDiagramProps): React.JSX.Element;
declare function ProcessFlow({ steps, links, title, description, className, }?: ProcessFlowProps): React.JSX.Element;
declare function Flowchart(props?: ProcessFlowProps): React.JSX.Element;
declare function JourneyMap({ stages, title, description, className, }?: JourneyMapProps): React.JSX.Element;
declare function SunburstChart({ data, title, description, className, }?: SunburstChartProps): React.JSX.Element;
declare function IcicleChart({ data, title, description, className, }?: IcicleChartProps): React.JSX.Element;
declare function CirclePacking({ data, title, description, className, }?: CirclePackingProps): React.JSX.Element;
declare function HierarchicalEdgeBundling(props?: HierarchicalEdgeBundlingProps): React.JSX.Element;

type NumericDomain = readonly [number, number];
interface LikertValues {
    stronglyDisagree?: number;
    disagree?: number;
    neutral?: number;
    agree?: number;
    stronglyAgree?: number;
}

interface ComparisonTooltipItem {
    label: string;
    value: string;
}
interface RadarDatum {
    metric: string;
    [series: string]: string | number | null | undefined;
}
interface RadarChartProps {
    data?: readonly RadarDatum[];
    keys?: readonly string[];
    domain?: NumericDomain;
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
}
type SpiderChartProps = RadarChartProps;
interface PolarDatum {
    name: string;
    value: number;
    color?: string;
}
interface PolarChartProps {
    data?: readonly PolarDatum[];
    domain?: NumericDomain;
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
    negativeValuePolicy?: "omit" | "clamp" | "absolute" | "signed";
}
type RoseChartProps = PolarChartProps;
type CoxcombChartProps = PolarChartProps;
interface PolarAreaChartProps extends PolarChartProps {
    innerRadius?: number;
}
interface NightingaleDatum {
    name: string;
    [series: string]: string | number | null | undefined;
}
interface NightingaleSeries {
    key: string;
    label: string;
    color?: string;
}
interface NightingaleRoseProps {
    data?: readonly NightingaleDatum[];
    series?: readonly NightingaleSeries[];
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
}
declare const defaultLollipop: {
    name: string;
    value: number;
}[];
declare const defaultDumbbell: {
    name: string;
    start: number;
    end: number;
}[];
interface SlopeDatum {
    name: string;
    start: number;
    end: number;
}
interface SlopeChartProps {
    data?: readonly SlopeDatum[];
    startLabel?: string;
    endLabel?: string;
    domain?: NumericDomain;
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
}
type ConnectedDotPlotProps = SlopeChartProps;
interface BumpDatum {
    period: string;
    [series: string]: string | number | null | undefined;
}
interface BumpChartProps {
    data?: readonly BumpDatum[];
    keys?: readonly string[];
    rankDomain?: NumericDomain;
    ariaLabel?: string;
    rankFormatter?: (rank: number) => string;
}
type NegativeMagnitudePolicy = "omit" | "clamp" | "absolute";
interface ButterflyDatum {
    name: string;
    left: number;
    right: number;
}
interface ButterflyChartProps {
    data?: readonly ButterflyDatum[];
    leftLabel?: string;
    rightLabel?: string;
    domain?: NumericDomain;
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
    negativeValuePolicy?: NegativeMagnitudePolicy;
}
interface TornadoDatum {
    name: string;
    low: number;
    high: number;
}
interface TornadoChartProps {
    data?: readonly TornadoDatum[];
    lowLabel?: string;
    highLabel?: string;
    domain?: NumericDomain;
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
    negativeValuePolicy?: NegativeMagnitudePolicy;
    sortByImpact?: boolean;
}
interface PopulationPyramidDatum {
    age: string;
    male: number;
    female: number;
}
interface PopulationPyramidProps {
    data?: readonly PopulationPyramidDatum[];
    maleLabel?: string;
    femaleLabel?: string;
    domain?: NumericDomain;
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
    negativeValuePolicy?: NegativeMagnitudePolicy;
}
interface DivergingBarDatum {
    topic: string;
    disagree: number;
    neutral: number;
    agree: number;
}
interface DivergingBarChartProps {
    data?: readonly DivergingBarDatum[];
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
}
interface LikertDatum extends LikertValues {
    topic: string;
}
interface LikertChartProps {
    data?: readonly LikertDatum[];
    normalize?: boolean;
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
}
declare function RadarChart(props: RadarChartProps): React.JSX.Element;
declare function SpiderChart(props: SpiderChartProps): React.JSX.Element;
declare function PolarChart({ data, domain, ariaLabel, valueFormatter, negativeValuePolicy, }: PolarChartProps): React.JSX.Element;
declare function RoseChart(props: RoseChartProps): React.JSX.Element;
declare function CoxcombChart(props: CoxcombChartProps): React.JSX.Element;
declare function NightingaleRose({ data, series, ariaLabel, valueFormatter, }: NightingaleRoseProps): React.JSX.Element;
declare function PolarAreaChart({ innerRadius, ...props }: PolarAreaChartProps): React.JSX.Element;
declare function LollipopChart({ data }: {
    data?: typeof defaultLollipop;
}): React.JSX.Element;
declare function DumbbellChart({ data }: {
    data?: typeof defaultDumbbell;
}): React.JSX.Element;
declare function ConnectedDotPlot({ data, startLabel, endLabel, domain, ariaLabel, valueFormatter, }: ConnectedDotPlotProps): React.JSX.Element;
declare function SlopeChart({ data, startLabel, endLabel, domain, ariaLabel, valueFormatter, }: SlopeChartProps): React.JSX.Element;
declare function BumpChart({ data, keys, rankDomain, ariaLabel, rankFormatter, }: BumpChartProps): React.JSX.Element;
declare function ButterflyChart({ data, leftLabel, rightLabel, domain, ariaLabel, valueFormatter, negativeValuePolicy, }: ButterflyChartProps): React.JSX.Element;
declare function TornadoChart({ data, lowLabel, highLabel, domain, ariaLabel, valueFormatter, negativeValuePolicy, sortByImpact, }: TornadoChartProps): React.JSX.Element;
declare function PopulationPyramid({ data, maleLabel, femaleLabel, domain, ariaLabel, valueFormatter, negativeValuePolicy, }: PopulationPyramidProps): React.JSX.Element;
declare function DivergingBarChart({ data, ariaLabel, valueFormatter, }: DivergingBarChartProps): React.JSX.Element;
declare function LikertChart({ data, normalize, ariaLabel, valueFormatter, }: LikertChartProps): React.JSX.Element;
interface WaffleChartProps {
    total?: number;
    value?: number;
    label?: string;
    maxCells?: number;
    columns?: number;
    ariaLabel?: string;
}
declare function WaffleChart({ total, value, label, maxCells, columns, ariaLabel, }: WaffleChartProps): React.JSX.Element;
type PictogramIcon = "person" | "star" | "circle" | "square";
interface PictogramChartProps {
    count?: number;
    filled?: number;
    label?: string;
    icon?: PictogramIcon;
    columns?: number;
    maxIcons?: number;
    ariaLabel?: string;
}
declare function PictogramChart({ count, filled, label, icon, columns, maxIcons, ariaLabel, }: PictogramChartProps): React.JSX.Element;
declare function IconArray(props: PictogramChartProps): React.JSX.Element;
type CompositionDatum = Record<string, unknown>;
type MekkoSeries = {
    key: string;
    label?: string;
    color?: string;
};
interface MekkoChartProps {
    data?: readonly CompositionDatum[];
    categoryKey?: string;
    widthKey?: string;
    series?: readonly MekkoSeries[];
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
    onCellSelect?: (event: {
        category: string;
        series: string;
        value: number;
        datum: CompositionDatum;
    }) => void;
}
declare function MekkoChart({ data, categoryKey, widthKey, series, ariaLabel, valueFormatter, onCellSelect, }: MekkoChartProps): React.JSX.Element;
declare function MarimekkoChart({ data, categoryKey, widthKey, series, ariaLabel, valueFormatter, onCellSelect, }: MekkoChartProps): React.JSX.Element;
declare function MosaicPlot({ data, categoryKey, widthKey, series, ariaLabel, valueFormatter, onCellSelect, }: MekkoChartProps): React.JSX.Element;
type ParallelCoordinateDatum = Record<string, unknown> & {
    id?: string;
    label?: string;
    group?: string;
};
type ParallelCoordinateDimension = {
    key: string;
    label?: string;
    domain?: NumericDomain;
    formatter?: (value: number) => string;
};
interface ParallelCoordinatesProps {
    data?: readonly ParallelCoordinateDatum[];
    dimensions?: readonly ParallelCoordinateDimension[];
    ariaLabel?: string;
    selectedId?: string | null;
    defaultSelectedId?: string | null;
    onSelectionChange?: (id: string | null, datum?: ParallelCoordinateDatum) => void;
    filters?: Readonly<Record<string, NumericDomain>>;
}
declare function ParallelCoordinates({ data, dimensions, ariaLabel, selectedId, defaultSelectedId, onSelectionChange, filters, }: ParallelCoordinatesProps): React.JSX.Element;
type ParallelSetDatum = Record<string, unknown> & {
    id?: string;
    weight?: number;
};
interface ParallelSetsProps {
    data?: readonly ParallelSetDatum[];
    dimensions?: readonly string[];
    weightKey?: string;
    ariaLabel?: string;
    onFlowSelect?: (event: {
        sourceDimension: string;
        targetDimension: string;
        source: string;
        target: string;
        weight: number;
    }) => void;
}
declare function ParallelSets({ data, dimensions, weightKey, ariaLabel, onFlowSelect }: ParallelSetsProps): React.JSX.Element;
type TernaryPoint = {
    id?: string;
    label?: string;
    a: number;
    b: number;
    c: number;
    group?: string | number;
};
interface TernaryPlotProps {
    data?: readonly TernaryPoint[];
    labels?: {
        a: string;
        b: string;
        c: string;
    };
    normalize?: boolean;
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
    onPointSelect?: (point: TernaryPoint, index: number) => void;
}
declare function TernaryPlot({ data, labels, normalize, ariaLabel, valueFormatter, onPointSelect, }: TernaryPlotProps): React.JSX.Element;

type ProjectTime = number | string;
type ProjectTask = {
    id: string;
    name: string;
    start: ProjectTime;
    end: ProjectTime;
    lane?: number;
    group?: string;
    progress?: number;
    dependencies?: string[];
    critical?: boolean;
    milestone?: boolean;
    status?: "planned" | "active" | "complete" | "blocked";
};
type TimelineEvent = {
    id: string;
    date: ProjectTime;
    label: string;
    description?: string;
    category?: string;
    status?: ProjectTask["status"];
};
type ProjectChartProps = {
    data: ProjectTask[];
    ariaLabel?: string;
    onTaskSelect?: (task: ProjectTask) => void;
};
declare function GanttChart(props: ProjectChartProps): React.JSX.Element;
declare function AdvancedGanttChart(props: ProjectChartProps): React.JSX.Element;
declare function GanttRangeChart(props: ProjectChartProps): React.JSX.Element;
type TimelineChartProps = {
    events: TimelineEvent[];
    ariaLabel?: string;
    onEventSelect?: (event: TimelineEvent) => void;
};
declare function TimelineChart({ events, ariaLabel, onEventSelect }: TimelineChartProps): React.JSX.Element;
declare function MilestoneChart(props: TimelineChartProps): React.JSX.Element;
declare function ProjectRoadmap(props: ProjectChartProps): React.JSX.Element;

declare function Streamgraph({ data }: {
    data?: typeof stackedSeries;
}): React.JSX.Element;
declare function HorizonChart({ data, bands, }: {
    data?: typeof timeSeries;
    bands?: number;
}): React.JSX.Element;
declare function StepChart({ data }: {
    data?: typeof timeSeries;
}): React.JSX.Element;
declare function SplineChart({ data }: {
    data?: typeof timeSeries;
}): React.JSX.Element;
type RangeChartDatum = {
    category: string;
    lower: number;
    upper: number;
} | {
    date: string;
    cost: number;
    revenue: number;
};
type RangeChartProps = {
    data?: RangeChartDatum[];
    interpolation?: "linear" | "monotone";
    xAxisLabel?: string;
    yAxisLabel?: string;
};
declare function RangeAreaChart({ data, interpolation, xAxisLabel, yAxisLabel, }: RangeChartProps): React.JSX.Element;
type BandChartDatum = {
    category: string;
    lower: number;
    upper: number;
    value: number;
};
type BandChartProps = {
    data?: readonly BandChartDatum[];
    ariaLabel?: string;
    interpolation?: "linear" | "monotone" | "step";
    valueFormatter?: (value: number) => string;
};
declare function BandChart({ data, ariaLabel, interpolation, valueFormatter, }: BandChartProps): React.JSX.Element;
declare function RangeColumnChart(props: RangeChartProps): React.JSX.Element;
declare function RangeBarChart(props: RangeChartProps): React.JSX.Element;
type FanChartDatum = {
    date: string;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
};
type FanChartProps = {
    data?: readonly FanChartDatum[];
    ariaLabel?: string;
    methodLabel?: string;
    valueFormatter?: (value: number) => string;
};
declare function FanChart({ data, ariaLabel, methodLabel, valueFormatter, }: FanChartProps): React.JSX.Element;
type ConfidenceIntervalDatum = {
    date: string;
    value: number;
    lower: number;
    upper: number;
};
type ConfidenceIntervalChartProps = {
    data?: readonly ConfidenceIntervalDatum[];
    ariaLabel?: string;
    intervalLabel?: string;
    valueFormatter?: (value: number) => string;
};
declare function ConfidenceIntervalChart({ data, ariaLabel, intervalLabel, valueFormatter, }: ConfidenceIntervalChartProps): React.JSX.Element;
declare function CandlestickChart({ data }: {
    data?: typeof ohlc;
}): React.JSX.Element;
declare function OHLCChart({ data }: {
    data?: typeof ohlc;
}): React.JSX.Element;
declare function StockChart({ data }: {
    data?: typeof ohlc;
}): React.JSX.Element;
type FinancialDatum = {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
};
type RenkoBrick = {
    index: number;
    date: string;
    open: number;
    close: number;
    direction: "up" | "down";
};
declare function buildRenkoBricks(data: readonly FinancialDatum[], requestedBrickSize?: number): {
    bricks: RenkoBrick[];
    brickSize: number;
};
declare function RenkoChart({ data, brickSize, }: {
    data?: FinancialDatum[];
    brickSize?: number;
}): React.JSX.Element;
type KagiSegment = {
    x1: number;
    x2: number;
    value1: number;
    value2: number;
    yang: boolean;
};
declare function buildKagiSegments(data: readonly FinancialDatum[], requestedReversal?: number): {
    segments: KagiSegment[];
    reversal: number;
};
declare function KagiChart({ data, reversalAmount, }: {
    data?: FinancialDatum[];
    reversalAmount?: number;
}): React.JSX.Element;
declare function FinancialWaterfall({ data }: {
    data?: typeof waterfallData;
}): React.JSX.Element;
declare function ParetoChart({ data }: {
    data?: typeof salesByRegion;
}): React.JSX.Element;
type ControlLimits = {
    mean: number;
    upper: number;
    lower: number;
    sigma: number;
};
declare function calculateControlLimits(values: readonly number[]): ControlLimits | null;
declare function ControlChart({ data }: {
    data?: typeof timeSeries;
}): React.JSX.Element;
type SpcObservation = {
    id?: string;
    category: string;
    value: number;
};
type SpcRule = "beyond-3-sigma" | "two-of-three-2-sigma" | "four-of-five-1-sigma" | "eight-on-one-side";
type SpcChartProps = {
    data?: readonly SpcObservation[] | typeof timeSeries;
    rules?: readonly SpcRule[];
    ariaLabel?: string;
    valueFormatter?: (value: number) => string;
};
type SpcSignal = {
    rules: readonly SpcRule[];
};
declare function calculateSpcSignals(values: readonly number[], limits: ControlLimits, enabledRules: readonly SpcRule[]): SpcSignal[];
declare function SPCChart({ data, rules, ariaLabel, valueFormatter, }: SpcChartProps): React.JSX.Element;
declare function RunChart({ data }: {
    data?: typeof timeSeries;
}): React.JSX.Element;
declare function FishboneDiagram(): React.JSX.Element;
declare function BowTieDiagram(): React.JSX.Element;
declare function VennDiagram(): React.JSX.Element;
declare function EulerDiagram(): React.JSX.Element;
type CloudDatum = {
    text: string;
    value: number;
};
type WordCloudProps = {
    data?: readonly CloudDatum[];
    ariaLabel?: string;
};
declare function WordCloud({ data, ariaLabel }: WordCloudProps): React.JSX.Element;
declare function TagCloud(props: React.ComponentProps<typeof WordCloud>): React.JSX.Element;
type CalendarDateInput = string | Date;
type CalendarDatum = {
    date: CalendarDateInput;
    value: number;
    label?: string;
};
type CalendarSelectionProps = {
    selectedDate?: string | null;
    defaultSelectedDate?: string | null;
    onDateSelect?: (date: string, datum: CalendarDatum) => void;
};
type CalendarHeatmapProps = CalendarSelectionProps & {
    data?: readonly CalendarDatum[];
    weekStartsOn?: 0 | 1;
    locale?: string;
    ariaLabel?: string;
    color?: string;
    valueFormatter?: (value: number) => string;
};
type CalendarVisualProps = CalendarSelectionProps & {
    data?: readonly CalendarDatum[];
    /** Month to show. ISO `YYYY-MM`, ISO date, and Date values are accepted. */
    month?: CalendarDateInput;
    weekStartsOn?: 0 | 1;
    locale?: string;
    ariaLabel?: string;
    color?: string;
    valueFormatter?: (value: number) => string;
    showValues?: boolean;
};
declare function CalendarHeatmap({ data, weekStartsOn, locale, ariaLabel, color, valueFormatter, selectedDate, defaultSelectedDate, onDateSelect, }: CalendarHeatmapProps): React.JSX.Element;
declare function CalendarVisual({ data, month, weekStartsOn, locale, ariaLabel, color, valueFormatter, showValues, selectedDate, defaultSelectedDate, onDateSelect, }: CalendarVisualProps): React.JSX.Element;
declare function KPITicker({ metrics }: {
    metrics?: typeof kpiMetrics;
}): React.JSX.Element;
declare function DataTicker({ metrics }: {
    metrics?: typeof kpiMetrics;
}): React.JSX.Element;
declare function ScrollingText({ items, autoplay, intervalMs, }: {
    items?: string[];
    autoplay?: boolean;
    intervalMs?: number;
}): React.JSX.Element;
type MotionMode = "auto" | "off";
type AnimatedPlaybackProps = {
    /** Controlled zero-based frame index. */
    value?: number;
    /** Initial zero-based frame index for uncontrolled playback. */
    defaultValue?: number;
    onValueChange?: (frameIndex: number) => void;
    autoplay?: boolean;
    intervalMs?: number;
    motion?: MotionMode;
};
type BarRaceDatum = {
    id?: string;
    name: string;
    value: number;
};
type BarRaceFrame = {
    id?: string;
    label: string;
    values: readonly BarRaceDatum[];
};
type AnimatedBarRaceProps = AnimatedPlaybackProps & {
    frames?: readonly BarRaceFrame[];
    ariaLabel?: string;
    topN?: number;
};
declare function AnimatedBarRace({ frames, autoplay, intervalMs, motion, value, defaultValue, onValueChange, ariaLabel, topN, }: AnimatedBarRaceProps): React.JSX.Element;
type AnimatedScatterFrame = {
    id?: string;
    label: string;
    points: readonly {
        id: string;
        x: number;
        y: number;
        size?: number;
        category?: string;
    }[];
};
type AnimatedScatterProps = AnimatedPlaybackProps & {
    frames?: readonly AnimatedScatterFrame[];
    ariaLabel?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
};
declare function AnimatedScatter({ frames, autoplay, intervalMs, motion, value, defaultValue, onValueChange, ariaLabel, xAxisLabel, yAxisLabel, }: AnimatedScatterProps): React.JSX.Element;
type AnimatedTimelineFrame = {
    id?: string;
    label: string;
    events: readonly TimelineEvent[];
};
type AnimatedTimelineProps = AnimatedPlaybackProps & {
    frames?: readonly AnimatedTimelineFrame[];
    /** @deprecated Prefer explicit `frames`; retained for source compatibility. */
    events?: readonly TimelineEvent[];
    ariaLabel?: string;
};
declare function AnimatedTimeline({ frames, events, autoplay, intervalMs, motion, value, defaultValue, onValueChange, ariaLabel, }: AnimatedTimelineProps): React.JSX.Element;
type ChartImage = {
    id?: string;
    src: string;
    alt: string;
    caption?: string;
    fallbackSrc?: string;
    objectPosition?: string;
    loading?: "eager" | "lazy";
    width?: number;
    height?: number;
};
type ImageGridProps = {
    images?: readonly ChartImage[];
    columns?: 1 | 2 | 3 | 4;
    fit?: "cover" | "contain";
    ariaLabel?: string;
    onImageLoad?: (image: ChartImage, index: number) => void;
    onImageError?: (image: ChartImage, index: number) => void;
};
declare function ImageGrid({ images, columns, fit, ariaLabel, onImageLoad, onImageError, }: ImageGridProps): React.JSX.Element;
type ImageCarouselProps = AnimatedPlaybackProps & {
    images?: readonly ChartImage[];
    fit?: "cover" | "contain";
    ariaLabel?: string;
    onImageLoad?: ImageGridProps["onImageLoad"];
    onImageError?: ImageGridProps["onImageError"];
};
declare function ImageCarousel({ images, autoplay, intervalMs, motion, value, defaultValue, onValueChange, fit, ariaLabel, onImageLoad, onImageError, }: ImageCarouselProps): React.JSX.Element;

export { AdvancedGanttChart, AlluvialDiagram, type AlluvialDiagramProps, AnimatedBarRace, type AnimatedBarRaceProps, type AnimatedPlaybackProps, AnimatedScatter, type AnimatedScatterFrame, type AnimatedScatterProps, AnimatedTimeline, type AnimatedTimelineFrame, type AnimatedTimelineProps, BandChart, type BandChartDatum, type BandChartProps, type BarRaceDatum, type BarRaceFrame, BeeswarmPlot, BowTieDiagram, BoxPlot, BumpChart, type BumpChartProps, type BumpDatum, ButterflyChart, type ButterflyChartProps, type ButterflyDatum, type CalendarDateInput, type CalendarDatum, CalendarHeatmap, type CalendarHeatmapProps, type CalendarSelectionProps, CalendarVisual, type CalendarVisualProps, CandlestickChart, type ChartImage, ChartTooltip, type ChordDatum, ChordDiagram, type ChordDiagramProps, type ChordInput, CirclePacking, type CirclePackingProps, type CloudDatum, ClusterPlot, ColumnSparkline, ComboChart, type ComboVariant, type ComparisonTooltipItem, type CompositionDatum, type ConfidenceBandDatum, ConfidenceBandPlot, type ConfidenceBandPlotProps, ConfidenceIntervalChart, type ConfidenceIntervalChartProps, type ConfidenceIntervalDatum, ConfusionMatrix, ConnectedDotPlot, type ConnectedDotPlotProps, type ContourGrid, ContourPlot, type ContourPlotProps, ControlChart, type ControlLimits, Correlogram, CoxcombChart, type CoxcombChartProps, DataBar, DataTicker, DecisionTree, type DecisionTreeProps, Dendrogram, DensityPlot, DependencyGraph, type DependencyGraphProps, type DependencyLinkDatum, type DependencyNodeDatum, DivergingBarChart, type DivergingBarChartProps, type DivergingBarDatum, DotDensityChart, DumbbellChart, ErrorBarPlot, EulerDiagram, FacetedPlot, FanChart, type FanChartDatum, type FanChartProps, FeatureImportanceChart, type FinancialDatum, FinancialWaterfall, FishboneDiagram, type FlowHierarchyChartProps, Flowchart, ForceDirectedNetwork, type ForceDirectedNetworkProps, FrequencyPolygon, FunnelChart, type FunnelChartProps, type FunnelDatum, GanttChart, GanttRangeChart, HexbinPlot, HierarchicalEdgeBundling, type HierarchicalEdgeBundlingProps, type HierarchicalEdgeLinkDatum, Histogram, HorizonChart, IcicleChart, type IcicleChartProps, IconArray, ImageCarousel, type ImageCarouselProps, ImageGrid, type ImageGridProps, JitterPlot, type JourneyDatum, JourneyMap, type JourneyMapProps, KPITicker, KagiChart, type KagiSegment, KernelDensityPlot, LikertChart, type LikertChartProps, type LikertDatum, LineSparkline, type LinearRegressionResult, LollipopChart, MarimekkoChart, MekkoChart, type MekkoChartProps, type MekkoSeries, MilestoneChart, MosaicPlot, type MotionMode, type NegativeMagnitudePolicy, NetworkDiagram, type NetworkDiagramProps, type NetworkLinkDatum, type NetworkNodeDatum, NetworkPlot, type NightingaleDatum, NightingaleRose, type NightingaleRoseProps, type NightingaleSeries, OHLCChart, OrgChart, type OrgChartProps, PCAPlot, PairPlot, type ParallelCoordinateDatum, type ParallelCoordinateDimension, ParallelCoordinates, type ParallelCoordinatesProps, type ParallelSetDatum, ParallelSets, type ParallelSetsProps, ParetoChart, PictogramChart, type PictogramChartProps, type PictogramIcon, PieDonutChart, PolarAreaChart, type PolarAreaChartProps, PolarChart, type PolarChartProps, type PolarDatum, PopulationPyramid, type PopulationPyramidDatum, type PopulationPyramidProps, type PositionedProcessStep, PrecisionRecallCurve, ProcessFlow, type ProcessFlowLayout, type ProcessFlowLinkDatum, type ProcessFlowProps, type ProcessFlowStepDatum, type ProjectChartProps, ProjectRoadmap, type ProjectTask, type ProjectTime, QQPlot, ROCCurve, RadarChart, type RadarChartProps, type RadarDatum, RaincloudPlot, RangeAreaChart, RangeBarChart, type RangeChartDatum, type RangeChartProps, RangeColumnChart, RegressionPlot, type RegressionPoint, type RenkoBrick, RenkoChart, ResidualPlot, type ResolvedNetworkLink, type ResolvedNetworkNode, RibbonChart, type RibbonChartProps, type RibbonDatum, RidgelinePlot, RiskMatrix, type RiskMatrixDatum, type RiskMatrixProps, RoseChart, type RoseChartProps, RunChart, SPCChart, SankeyDiagram, type SankeyDiagramProps, type SankeyLayout, type SankeyLayoutLink, type SankeyLayoutNode, type SankeyLinkDatum, type SankeyNodeDatum, ScatterBubbleChart, type ScatterBubbleChartProps, type ScatterBubbleDatum, ScatterplotMatrix, ScrollingText, SlopeChart, type SlopeChartProps, type SlopeDatum, type SpcChartProps, type SpcObservation, type SpcRule, type SpcSignal, SpiderChart, type SpiderChartProps, SplineChart, StatisticalHeatmap, StepChart, StockChart, Streamgraph, StripPlot, SunburstChart, type SunburstChartProps, SurvivalCurve, TagCloud, TernaryPlot, type TernaryPlotProps, type TernaryPoint, TimelineChart, type TimelineChartProps, type TimelineEvent, TornadoChart, type TornadoChartProps, type TornadoDatum, type TreeChartProps, type TreeDatum, TreeDiagram, type TreeDiagramProps, TreemapChart, type TreemapChartProps, type TreemapNode, type TreemapSelectionEvent, type ValidationResult, VennDiagram, ViolinPlot, WaffleChart, type WaffleChartProps, WaterfallChart, type WaterfallChartProps, type WaterfallPoint, WordCloud, type WordCloudProps, buildKagiSegments, buildRenkoBricks, buildSankeyLayout, calculateControlLimits, calculateSpcSignals, exactNumber, layoutProcessFlow, legendLabel, linearRegression, shapeWaterfall, standardNormalQuantile, validateChordInput, validateNetworkInput, validateTreeInput };
