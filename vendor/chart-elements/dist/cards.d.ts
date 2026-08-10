import * as React from 'react';

type ValueDisplayFormat = "number" | "currency" | "percent";
interface ValueFormatterContext {
    format: ValueDisplayFormat;
    locale: string;
    currency: string;
    compact: boolean;
}
type ValueFormatter = (value: number, context: ValueFormatterContext) => string;
interface ValueFormatOptions {
    format?: ValueDisplayFormat;
    locale?: string;
    currency?: string;
    formatter?: ValueFormatter;
    compact?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
}
declare function formatCardValue(value: number, options?: ValueFormatOptions): string;
declare function formatCardPercent(value: number, locale?: string, digits?: number): string;
type PerformanceDirection = "higher-is-better" | "lower-is-better";
type KpiStatus = "on-track" | "at-risk" | "off-track" | "not-set";
/** Binary treats a zero target as met/not met; hide-progress omits its progress track. */
type ZeroTargetPolicy = "binary" | "hide-progress";
/** Negative targets cannot form a meaningful ratio without a baseline. */
type NegativeTargetPolicy = "binary" | "hide-progress";
declare function isGoalMet(value: number, target: number, direction?: PerformanceDirection): boolean;
declare function deriveKpiStatus(value: number, target: number | undefined, direction?: PerformanceDirection, atRiskTolerance?: number): KpiStatus;
declare function targetProgress(value: number, target: number, direction?: PerformanceDirection, zeroTargetPolicy?: ZeroTargetPolicy, negativeTargetPolicy?: NegativeTargetPolicy): number | null;
/**
 * clamp: pin the indicator to the scale end; indicate: clamp and show a label;
 * hide: omit the indicator while retaining the raw formatted value.
 */
type RangeBoundaryPolicy = "clamp" | "indicate" | "hide";
type RangeState = "within" | "below" | "above" | "invalid";
interface RangePolicyOptions {
    underflowPolicy?: RangeBoundaryPolicy;
    overflowPolicy?: RangeBoundaryPolicy;
}
interface NormalizedRange {
    min: number;
    max: number;
    rawValue: number;
    meterValue: number;
    fraction: number;
    state: RangeState;
    indicatorVisible: boolean;
    shouldIndicate: boolean;
}
declare function normalizeRange(value: number, minValue: number, maxValue: number, { underflowPolicy, overflowPolicy, }?: RangePolicyOptions): NormalizedRange;
interface GaugeThreshold {
    to: number;
    color: string;
    label?: string;
}
declare function normalizeThresholds(thresholds: readonly GaugeThreshold[] | undefined, min: number, max: number): GaugeThreshold[];
type GaugeSize = "sm" | "md" | "lg" | number | string;
declare function gaugeSize(size: GaugeSize | undefined, fallback: number): string;

interface MetricDatum extends ValueFormatOptions {
    id?: string;
    label: string;
    value: number;
    delta?: number;
    target?: number;
    category?: string;
    imageUrl?: string;
    imageAlt?: string;
    /** Optional trend series rendered as a decorative sparkline. */
    spark?: readonly number[];
    format?: ValueDisplayFormat;
    direction?: PerformanceDirection;
}
/** Backward-compatible public name. */
type Metric = MetricDatum;
interface MetricFormattingProps {
    format?: ValueDisplayFormat;
    locale?: string;
    currency?: string;
    formatter?: ValueFormatter;
    compact?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
}
type CardSize = "sm" | "md" | "lg";
interface MetricValueProps extends MetricFormattingProps {
    metric: MetricDatum;
    value?: number;
    className?: string;
    animate?: boolean;
    animationDuration?: number;
}
interface ModernCardProps extends MetricFormattingProps {
    metric: MetricDatum;
    withReference?: boolean;
    withImage?: boolean;
    size?: CardSize;
    className?: string;
    animate?: boolean;
    animationDuration?: number;
}
declare function ModernCard({ metric, withReference, withImage, size, className, animate, animationDuration, ...formatting }: ModernCardProps): React.JSX.Element;
interface MetricCollectionProps extends MetricFormattingProps {
    metrics: readonly MetricDatum[];
    className?: string;
    animate?: boolean;
    animationDuration?: number;
}
interface MultiCardLayoutProps extends MetricCollectionProps {
    minCardWidth?: number | string;
}
declare function MultiCardLayout({ metrics, className, minCardWidth, animate, animationDuration, ...formatting }: MultiCardLayoutProps): React.JSX.Element;
interface MultiCategoryCardsProps extends MetricCollectionProps {
    minCardWidth?: number | string;
}
declare function MultiCategoryCards({ metrics, className, minCardWidth, animate, animationDuration, ...formatting }: MultiCategoryCardsProps): React.JSX.Element;
interface LegacyCardProps extends MetricFormattingProps {
    metric: MetricDatum;
    className?: string;
    size?: CardSize;
    animate?: boolean;
    animationDuration?: number;
}
declare function LegacyCard({ metric, className, size, animate, animationDuration, ...formatting }: LegacyCardProps): React.JSX.Element;
type MultiRowCardProps = MetricCollectionProps;
declare function MultiRowCard({ metrics, className, animate, animationDuration, ...formatting }: MultiRowCardProps): React.JSX.Element;
interface KpiVisualProps extends MetricFormattingProps {
    metric: MetricDatum;
    status?: KpiStatus;
    dense?: boolean;
    className?: string;
    atRiskTolerance?: number;
    zeroTargetPolicy?: ZeroTargetPolicy;
    negativeTargetPolicy?: NegativeTargetPolicy;
    animate?: boolean;
    animationDuration?: number;
}
declare function KpiVisual({ metric, status, dense, className, atRiskTolerance, zeroTargetPolicy, negativeTargetPolicy, animate, animationDuration, ...formatting }: KpiVisualProps): React.JSX.Element;
interface ScorecardProps extends MetricCollectionProps {
    atRiskTolerance?: number;
    zeroTargetPolicy?: ZeroTargetPolicy;
    negativeTargetPolicy?: NegativeTargetPolicy;
}
declare function Scorecard({ metrics, className, atRiskTolerance, zeroTargetPolicy, negativeTargetPolicy, animate, animationDuration, ...formatting }: ScorecardProps): React.JSX.Element;
interface TrafficLightKpiProps extends MetricFormattingProps {
    metric: MetricDatum;
    className?: string;
    status?: KpiStatus;
    atRiskTolerance?: number;
    animate?: boolean;
    animationDuration?: number;
}
declare function TrafficLightKpi({ metric, className, status, atRiskTolerance, animate, animationDuration, ...formatting }: TrafficLightKpiProps): React.JSX.Element;

interface GaugeDatum {
    value: number;
    label?: string;
}
type GaugeFormattingProps = ValueFormatOptions;
interface GaugeRangeProps extends RangePolicyOptions {
    min?: number;
    max?: number;
}
type TargetRangePolicy = "clamp" | "include" | "hide";
interface RadialGaugeProps extends GaugeFormattingProps, GaugeRangeProps {
    value: number;
    label?: string;
    ranges?: readonly GaugeThreshold[];
    size?: GaugeSize;
    thickness?: number;
    color?: string;
    className?: string;
    animate?: boolean;
}
declare function RadialGauge(props: RadialGaugeProps): React.JSX.Element;
interface LinearGaugeProps extends GaugeFormattingProps, GaugeRangeProps {
    value: number;
    label?: string;
    color?: string;
    trackHeight?: number;
    className?: string;
    animate?: boolean;
}
declare function LinearGauge(props: LinearGaugeProps): React.JSX.Element;
interface BulletThresholds {
    poor: number;
    satisfactory: number;
}
type BulletRangeBoundaries = readonly [number, number] | BulletThresholds;
interface BulletChartProps extends GaugeFormattingProps, GaugeRangeProps {
    value: number;
    target: number;
    label?: string;
    ranges?: BulletRangeBoundaries;
    direction?: PerformanceDirection;
    targetRangePolicy?: TargetRangePolicy;
    zeroTargetPolicy?: ZeroTargetPolicy;
    negativeTargetPolicy?: NegativeTargetPolicy;
    color?: string;
    className?: string;
    animate?: boolean;
}
declare function BulletChart(props: BulletChartProps): React.JSX.Element;
interface ProgressRingProps extends GaugeFormattingProps, GaugeRangeProps {
    value: number;
    label?: string;
    size?: GaugeSize;
    thickness?: number;
    color?: string;
    className?: string;
    animate?: boolean;
}
declare function ProgressRing(props: ProgressRingProps): React.JSX.Element;
interface ProgressBarProps extends GaugeFormattingProps, GaugeRangeProps {
    value: number;
    label?: string;
    color?: string;
    trackHeight?: number;
    className?: string;
    animate?: boolean;
}
declare function ProgressBar(props: ProgressBarProps): React.JSX.Element;
interface ThermometerGaugeProps extends GaugeFormattingProps, GaugeRangeProps {
    value: number;
    label?: string;
    size?: GaugeSize;
    color?: string;
    className?: string;
    animate?: boolean;
}
declare function ThermometerGauge(props: ThermometerGaugeProps): React.JSX.Element;
interface DialGaugeProps extends GaugeFormattingProps, GaugeRangeProps {
    value: number;
    label?: string;
    size?: GaugeSize;
    thickness?: number;
    color?: string;
    className?: string;
    animate?: boolean;
}
declare function DialGauge(props: DialGaugeProps): React.JSX.Element;

export { BulletChart, type BulletChartProps, type BulletRangeBoundaries, type BulletThresholds, type CardSize, DialGauge, type DialGaugeProps, type GaugeDatum, type GaugeFormattingProps, type GaugeRangeProps, type GaugeSize, type GaugeThreshold, type KpiStatus, KpiVisual, type KpiVisualProps, LegacyCard, type LegacyCardProps, LinearGauge, type LinearGaugeProps, type Metric, type MetricCollectionProps, type MetricDatum, type MetricFormattingProps, type MetricValueProps, ModernCard, type ModernCardProps, MultiCardLayout, type MultiCardLayoutProps, MultiCategoryCards, type MultiCategoryCardsProps, MultiRowCard, type MultiRowCardProps, type NegativeTargetPolicy, type NormalizedRange, type PerformanceDirection, ProgressBar, type ProgressBarProps, ProgressRing, type ProgressRingProps, RadialGauge, type RadialGaugeProps, type RangeBoundaryPolicy, type RangePolicyOptions, type RangeState, Scorecard, type ScorecardProps, type TargetRangePolicy, ThermometerGauge, type ThermometerGaugeProps, TrafficLightKpi, type TrafficLightKpiProps, type ValueDisplayFormat, type ValueFormatOptions, type ValueFormatter, type ValueFormatterContext, type ZeroTargetPolicy, deriveKpiStatus, formatCardPercent, formatCardValue, gaugeSize, isGoalMet, normalizeRange, normalizeThresholds, targetProgress };
