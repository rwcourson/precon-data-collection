import * as React$1 from 'react';
import * as class_variance_authority_types from 'class-variance-authority/types';
import { VariantProps } from 'class-variance-authority';
export { Button, ButtonProps } from './ui/button.js';

declare const badgeVariants: (props?: ({
    variant?: "default" | "secondary" | "outline" | "success" | "danger" | "warning" | null | undefined;
} & class_variance_authority_types.ClassProp) | undefined) => string;
declare function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>): React$1.JSX.Element;

declare function Card({ className, ...props }: React$1.HTMLAttributes<HTMLDivElement>): React$1.JSX.Element;
declare function CardHeader({ className, ...props }: React$1.HTMLAttributes<HTMLDivElement>): React$1.JSX.Element;
declare function CardTitle({ className, ...props }: React$1.HTMLAttributes<HTMLHeadingElement>): React$1.JSX.Element;
declare function CardDescription({ className, ...props }: React$1.HTMLAttributes<HTMLParagraphElement>): React$1.JSX.Element;
declare function CardContent({ className, ...props }: React$1.HTMLAttributes<HTMLDivElement>): React$1.JSX.Element;

/** `yyyy-MM-dd` — the wire format the native date input used, kept for parity. */
type IsoDate = string;
declare function toIso(date: Date): IsoDate;
declare function fromIso(value?: IsoDate | null): Date | undefined;
type CalendarProps = {
    /** The selected day. */
    value?: IsoDate;
    onSelect: (value: IsoDate) => void;
    /**
     * Shades the days between two dates. Used by the range slicer so each of its
     * two fields shows the span the other end has already set.
     */
    range?: {
        start?: IsoDate;
        end?: IsoDate;
    };
    /** Inclusive bounds; days outside them are shown but not selectable. */
    min?: IsoDate;
    max?: IsoDate;
    /**
     * Reference for the "today" marker. Pass a fixed date to keep server and
     * client markup identical when the calendar is rendered inline.
     */
    today?: Date;
    weekStartsOn?: 0 | 1;
    /** Moves focus into the grid on mount, for use inside a popover. */
    autoFocus?: boolean;
    className?: string;
};
declare function Calendar({ value, onSelect, range, min, max, today, weekStartsOn, autoFocus, className, }: CalendarProps): React$1.JSX.Element;

type DateFieldProps = {
    value?: IsoDate;
    onChange: (value: IsoDate) => void;
    placeholder?: string;
    disabled?: boolean;
    /** `sm` matches compact rows; `default` matches `Input`. */
    size?: "default" | "sm";
    min?: IsoDate;
    max?: IsoDate;
    /** Shades the span already set by a sibling field in a range. */
    range?: {
        start?: IsoDate;
        end?: IsoDate;
    };
    /** Fixed reference for "today", so demos and SSR stay deterministic. */
    today?: Date;
    /** How the chosen date reads in the trigger. */
    displayFormat?: string;
    className?: string;
    id?: string;
    "aria-label"?: string;
};
/**
 * Date input with a themed calendar popover.
 *
 * Replaces `<input type="date">`, whose picker is drawn by the browser: a white
 * panel with the OS accent colour and its own type and metrics, which ignores the
 * theme and does not follow dark mode.
 */
declare function DateField({ value, onChange, placeholder, disabled, size, min, max, range, today, displayFormat, className, id, "aria-label": ariaLabel, }: DateFieldProps): React$1.JSX.Element;

declare const Input: React$1.ForwardRefExoticComponent<React$1.InputHTMLAttributes<HTMLInputElement> & React$1.RefAttributes<HTMLInputElement>>;

type SelectOption = {
    label: string;
    value: string;
    disabled?: boolean;
    count?: number;
};
type SelectProps = {
    options: SelectOption[];
    /** Always an array so single- and multi-select share one shape. */
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    /** Keeps the menu open and toggles options instead of replacing the value. */
    multiple?: boolean;
    disabled?: boolean;
    /**
     * Adds a leading row that clears the selection, e.g. "All". Single-select only —
     * a multi-select clears by unticking. Without it the only way back to an empty
     * value is re-clicking the chosen row, which nothing on screen advertises.
     */
    clearLabel?: string;
    /** `sm` matches compact rows such as a date hierarchy; `default` matches `Input`. */
    size?: "default" | "sm";
    className?: string;
    id?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    maxMenuHeight?: number;
};
/**
 * Select-only combobox (WAI-ARIA pattern): focus stays on the trigger and the
 * active option is tracked with `aria-activedescendant`.
 *
 * Replaces a native `<select>`, whose popup is drawn by the OS and so ignores the
 * theme entirely — a grey system menu with a blue highlight in the middle of a
 * light dashboard.
 */
declare function Select({ options, value, onChange, placeholder, multiple, disabled, clearLabel, size, className, id, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby, maxMenuHeight, }: SelectProps): React$1.JSX.Element;

declare function ThemeToggle(): React$1.JSX.Element;

export { Badge, Calendar, type CalendarProps, Card, CardContent, CardDescription, CardHeader, CardTitle, DateField, type DateFieldProps, Input, type IsoDate, Select, type SelectOption, type SelectProps, ThemeToggle, fromIso, toIso };
