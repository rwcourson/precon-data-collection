import * as React from 'react';
import { VisualizationSpec, EmbedOptions, Result } from 'vega-embed';

type DeclarativeRendererMode = "vega" | "vega-lite";
type DeclarativeVisualProps = {
    spec: VisualizationSpec;
    mode?: DeclarativeRendererMode;
    className?: string;
    style?: React.CSSProperties;
    ariaLabel?: string;
    renderer?: "svg" | "canvas";
    /**
     * Vega specifications can load remote data and images. Network access is
     * disabled by default; opt in only for trusted specifications and sources.
     */
    allowExternalData?: boolean;
    options?: Omit<EmbedOptions, "mode" | "renderer" | "actions" | "defaultStyle">;
    onViewReady?: (view: Result["view"]) => void;
    onError?: (error: Error) => void;
};
type VegaChartProps = Omit<DeclarativeVisualProps, "mode">;
type VegaLiteChartProps = Omit<DeclarativeVisualProps, "mode">;
type DenebSpecRendererProps = DeclarativeVisualProps & {
    showNonAffiliationNotice?: boolean;
};
type ScientificSpecVisualProps = VegaLiteChartProps & {
    methodLabel: string;
    units?: string;
    reference?: string;
};
/** Return spec locations that can initiate a network request. */
declare function findExternalReferences(spec: unknown): string[];
declare function DeclarativeVisual({ spec, mode, className, style, ariaLabel, renderer, allowExternalData, options, onViewReady, onError, }: DeclarativeVisualProps): React.JSX.Element;
declare function VegaChart(props: VegaChartProps): React.JSX.Element;
declare function VegaLiteChart(props: VegaLiteChartProps): React.JSX.Element;
/**
 * Independent compatibility surface for Vega/Vega-Lite specifications often
 * authored for Deneb. This component is not the Microsoft visual and does not
 * implement Deneb host APIs.
 */
declare function DenebSpecRenderer({ showNonAffiliationNotice, ...props }: DenebSpecRendererProps): React.JSX.Element;
/** General scientific-spec surface with explicit method, units, and provenance. */
declare function ScientificSpecVisual({ methodLabel, units, reference, ...props }: ScientificSpecVisualProps): React.JSX.Element;

export { type DeclarativeRendererMode, DeclarativeVisual, type DeclarativeVisualProps, DenebSpecRenderer, type DenebSpecRendererProps, ScientificSpecVisual, type ScientificSpecVisualProps, VegaChart, type VegaChartProps, VegaLiteChart, type VegaLiteChartProps, findExternalReferences };
