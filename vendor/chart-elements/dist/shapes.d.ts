import * as React from 'react';

interface VisualFrameProps {
    className?: string;
    children: React.ReactNode;
    frameTitle?: React.ReactNode;
    /** Set false when composing the visual inside an existing card or chart frame. */
    framed?: boolean;
}
type ImageFit = "cover" | "contain" | "fill" | "none" | "scale-down";
interface ImageSourceModel {
    src: string;
    alt: string;
    caption?: React.ReactNode;
}
interface ImageFallbackState {
    src?: string;
    alt: string;
    reason: "missing" | "error";
}
type ImageFallback = React.ReactNode | ((state: ImageFallbackState) => React.ReactNode);
interface ImageVisualProps {
    source?: ImageSourceModel;
    src?: string;
    alt?: string;
    caption?: React.ReactNode;
    fallback?: ImageFallback;
    fit?: ImageFit;
    objectPosition?: React.CSSProperties["objectPosition"];
    className?: string;
    imageClassName?: string;
    height?: number | string;
    framed?: boolean;
    frameTitle?: React.ReactNode;
    loading?: "eager" | "lazy";
    decoding?: "async" | "auto" | "sync";
    onLoad?: React.ReactEventHandler<HTMLImageElement>;
    onError?: React.ReactEventHandler<HTMLImageElement>;
}
declare function ImageVisual({ source, src, alt, caption, fallback, fit, objectPosition, className, imageClassName, height, framed, frameTitle, loading, decoding, onLoad, onError, }: ImageVisualProps): React.JSX.Element;
interface StaticImageProps extends ImageVisualProps {
    placeholderLabel?: string;
}
declare function StaticImage({ source, alt, fallback, height, frameTitle, placeholderLabel, ...props }: StaticImageProps): React.JSX.Element;
interface DynamicImageProps extends ImageVisualProps {
    /** Key used to select an entry from sources and label the default fallback. */
    value?: string;
    sources?: Readonly<Record<string, ImageSourceModel | undefined>>;
}
declare function DynamicImage({ value, sources, source, src, alt, caption, fallback, height, frameTitle, ...props }: DynamicImageProps): React.JSX.Element;
interface TextBoxProps {
    text?: React.ReactNode;
    className?: string;
    align?: "left" | "center" | "right";
    framed?: boolean;
    frameTitle?: React.ReactNode;
}
declare function TextBox({ text, className, align, framed, frameTitle, }: TextBoxProps): React.JSX.Element;
interface DynamicTextProps {
    field?: React.ReactNode;
    value?: React.ReactNode;
    className?: string;
    framed?: boolean;
    frameTitle?: React.ReactNode;
}
declare function DynamicText({ field, value, className, framed, frameTitle, }: DynamicTextProps): React.JSX.Element;
interface RectangleShapeProps {
    className?: string;
    fill?: string;
    label?: React.ReactNode;
    labelColor?: string;
    ariaLabel?: string;
    width?: number | string;
    height?: number | string;
    framed?: boolean;
    frameTitle?: React.ReactNode;
}
declare function RectangleShape({ className, fill, label, labelColor, ariaLabel, width, height, framed, frameTitle, }: RectangleShapeProps): React.JSX.Element;
interface OvalShapeProps {
    className?: string;
    fill?: string;
    label?: React.ReactNode;
    labelColor?: string;
    ariaLabel?: string;
    width?: number | string;
    height?: number | string;
    framed?: boolean;
    frameTitle?: React.ReactNode;
}
declare function OvalShape({ className, fill, label, labelColor, ariaLabel, width, height, framed, frameTitle, }: OvalShapeProps): React.JSX.Element;
interface LineShapeProps {
    className?: string;
    color?: string;
    orientation?: "horizontal" | "vertical";
    thickness?: number;
    ariaLabel?: string;
    framed?: boolean;
    frameTitle?: React.ReactNode;
}
declare function LineShape({ className, color, orientation, thickness, ariaLabel, framed, frameTitle, }: LineShapeProps): React.JSX.Element;
interface ArrowShapeProps {
    className?: string;
    color?: string;
    direction?: "right" | "left" | "up" | "down";
    ariaLabel?: string;
    framed?: boolean;
    frameTitle?: React.ReactNode;
}
declare function ArrowShape({ className, color, direction, ariaLabel, framed, frameTitle, }: ArrowShapeProps): React.JSX.Element;
interface ReportShapeProps {
    className?: string;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    value?: React.ReactNode;
    ariaLabel?: string;
    framed?: boolean;
    frameTitle?: React.ReactNode;
}
declare function ReportShape({ className, title, subtitle, value, ariaLabel, framed, frameTitle, }: ReportShapeProps): React.JSX.Element;

export { ArrowShape, type ArrowShapeProps, DynamicImage, type DynamicImageProps, DynamicText, type DynamicTextProps, type ImageFallback, type ImageFallbackState, type ImageFit, type ImageSourceModel, ImageVisual, type ImageVisualProps, LineShape, type LineShapeProps, OvalShape, type OvalShapeProps, RectangleShape, type RectangleShapeProps, ReportShape, type ReportShapeProps, StaticImage, type StaticImageProps, TextBox, type TextBoxProps, type VisualFrameProps };
