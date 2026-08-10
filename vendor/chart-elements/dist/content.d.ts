import * as React from 'react';

type SafeHtmlVisualProps = {
    html: string;
    className?: string;
    ariaLabel?: string;
    allowLinks?: boolean;
    emptyMessage?: string;
};
type SafeSvgVisualProps = {
    svg: string;
    title: string;
    description?: string;
    className?: string;
};
type MatplotlibArtifactProps = {
    src: string;
    alt: string;
    format: "svg" | "png";
    generatedBy?: string;
    caption?: string;
    className?: string;
    fit?: "contain" | "cover";
};
declare function SafeHtmlVisual({ html, className, ariaLabel, allowLinks, emptyMessage, }: SafeHtmlVisualProps): React.JSX.Element;
declare function SafeSvgVisual({ svg, title, description, className }: SafeSvgVisualProps): React.JSX.Element;
declare function MatplotlibArtifact({ src, alt, format, generatedBy, caption, className, fit, }: MatplotlibArtifactProps): React.JSX.Element;

export { MatplotlibArtifact, type MatplotlibArtifactProps, SafeHtmlVisual, type SafeHtmlVisualProps, SafeSvgVisual, type SafeSvgVisualProps };
