import * as React from 'react';

type SlicerOption = {
    label: string;
    value: string;
    disabled?: boolean;
    count?: number;
    icon?: React.ReactNode;
    image?: string;
};
type HierarchicalOption = SlicerOption & {
    children?: HierarchicalOption[];
};
type DateRange = {
    start: string;
    end: string;
};
type NumericRange = {
    min: number | null;
    max: number | null;
};
type NumericFilter = {
    operator: "eq" | "gt" | "lt" | "between";
    value: number | NumericRange;
};
type BaseProps = {
    className?: string;
    label?: string;
    disabled?: boolean;
};
declare const DEFAULT_SLICER_OPTIONS: SlicerOption[];
declare const DEFAULT_HIERARCHY_OPTIONS: HierarchicalOption[];
type OptionsSlicerProps = BaseProps & {
    options?: SlicerOption[];
    value?: string[];
    defaultValue?: string[];
    onChange?: (value: string[]) => void;
    multiple?: boolean;
    maxHeight?: number;
};
declare function StandardSlicer({ options, value, defaultValue, onChange, multiple, label, className, maxHeight, disabled, }: OptionsSlicerProps): React.JSX.Element;
declare function VerticalListSlicer(props: OptionsSlicerProps): React.JSX.Element;
declare function DropdownSlicer({ options, value, defaultValue, onChange, label, className, disabled, multiple, }: OptionsSlicerProps): React.JSX.Element;
declare function TileSlicer({ options, value, defaultValue, onChange, multiple, label, className, disabled, columns, }: OptionsSlicerProps & {
    columns?: number;
}): React.JSX.Element;
declare function HierarchicalSlicer({ options, value, defaultValue, onChange, multiple, label, className, disabled, maxHeight, }: BaseProps & {
    options?: HierarchicalOption[];
    value?: string[];
    defaultValue?: string[];
    onChange?: (value: string[]) => void;
    multiple?: boolean;
    maxHeight?: number;
}): React.JSX.Element;
declare function SearchableSlicer({ options, value, defaultValue, onChange, multiple, label, className, disabled, placeholder, maxHeight, }: OptionsSlicerProps & {
    placeholder?: string;
}): React.JSX.Element;
type NumericSlicerProps = BaseProps & {
    value?: number | null;
    defaultValue?: number | null;
    onChange?: (value: number | null) => void;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
};
declare function NumericSlicer({ value, defaultValue, onChange, min, max, step, placeholder, label, className, disabled, }: NumericSlicerProps): React.JSX.Element;
type NumericRangeSlicerProps = BaseProps & {
    value?: NumericRange;
    defaultValue?: NumericRange;
    onChange?: (value: NumericRange) => void;
    min?: number;
    max?: number;
    step?: number;
};
declare function NumericRangeSlicer({ value, defaultValue, onChange, min, max, step, label, className, disabled, }: NumericRangeSlicerProps): React.JSX.Element;
declare function BetweenSlicer(props: Omit<NumericRangeSlicerProps, "label"> & {
    label?: string;
}): React.JSX.Element;
type ComparisonSlicerProps = Omit<NumericSlicerProps, "label"> & {
    label?: string;
};
declare function GreaterThanSlicer({ label, placeholder, ...props }: ComparisonSlicerProps): React.JSX.Element;
declare function LessThanSlicer({ label, placeholder, ...props }: ComparisonSlicerProps): React.JSX.Element;
type DateRangeSlicerProps = BaseProps & {
    value?: DateRange;
    defaultValue?: DateRange;
    onChange?: (value: DateRange) => void;
};
declare function DateRangeSlicer({ value, defaultValue, onChange, label, className, disabled, }: DateRangeSlicerProps): React.JSX.Element;
declare function DateHierarchySlicer({ value, defaultValue, onChange, label, className, disabled, levels, }: BaseProps & {
    value?: Record<string, string>;
    defaultValue?: Record<string, string>;
    onChange?: (value: Record<string, string>) => void;
    levels?: readonly string[];
}): React.JSX.Element;
type RelativeDatePreset = {
    label: string;
    value: string;
    getRange: () => DateRange;
};
declare function RelativeDateSlicer({ value, defaultValue, onChange, presets, label, className, disabled, onRangeChange, }: BaseProps & {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    presets?: RelativeDatePreset[];
    onRangeChange?: (range: DateRange) => void;
}): React.JSX.Element;
declare function RelativeTimeSlicer({ value, defaultValue, onChange, presets, label, className, disabled, onTimeChange, }: BaseProps & {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    presets?: {
        label: string;
        value: string;
        minutes: number;
    }[];
    onTimeChange?: (start: Date, end: Date) => void;
}): React.JSX.Element;
declare function DatePickerSlicer({ value, defaultValue, onChange, label, className, disabled, }: BaseProps & {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
}): React.JSX.Element;
type ButtonSlicerProps = OptionsSlicerProps & {
    orientation?: "horizontal" | "vertical";
    size?: "sm" | "default";
};
declare function ButtonSlicer(props: ButtonSlicerProps): React.JSX.Element;
declare function SingleSelectButtons(props: ButtonSlicerProps): React.JSX.Element;
declare function MultiSelectButtons(props: ButtonSlicerProps): React.JSX.Element;
declare function ButtonGrid({ columns, ...props }: ButtonSlicerProps & {
    columns?: number;
}): React.JSX.Element;
declare function ButtonList(props: ButtonSlicerProps): React.JSX.Element;
declare function ImageButtons(props: OptionsSlicerProps): React.JSX.Element;
declare function IconButtons(props: ButtonSlicerProps): React.JSX.Element;
declare function ListSlicer(props: OptionsSlicerProps): React.JSX.Element;
declare function SearchableListSlicer(props: OptionsSlicerProps & {
    placeholder?: string;
}): React.JSX.Element;
declare function HierarchicalListSlicer(props: BaseProps & {
    options?: HierarchicalOption[];
    value?: string[];
    defaultValue?: string[];
    onChange?: (value: string[]) => void;
    multiple?: boolean;
    maxHeight?: number;
}): React.JSX.Element;
declare function ConditionalListSlicer({ options, condition, value, defaultValue, onChange, label, className, disabled, multiple, maxHeight, }: OptionsSlicerProps & {
    condition?: (option: SlicerOption) => boolean;
}): React.JSX.Element;
type TextFilterProps = BaseProps & {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
};
declare function InputSlicer(props: TextFilterProps): React.JSX.Element;
declare function ExactTextFilter(props: TextFilterProps): React.JSX.Element;
declare function ContainsFilter(props: TextFilterProps): React.JSX.Element;
declare function StartsWithFilter(props: TextFilterProps): React.JSX.Element;
declare function NumericInputFilter(props: NumericSlicerProps): React.JSX.Element;
declare function FreeFormInput(props: TextFilterProps): React.JSX.Element;
declare function PastedValueFilter({ value, defaultValue, onChange, label, className, disabled, separator, }: BaseProps & {
    value?: string[];
    defaultValue?: string[];
    onChange?: (value: string[]) => void;
    separator?: RegExp | string;
}): React.JSX.Element;
declare function InputCollection({ value, defaultValue, onChange, label, className, disabled, placeholder, }: BaseProps & {
    value?: string[];
    defaultValue?: string[];
    onChange?: (value: string[]) => void;
    placeholder?: string;
}): React.JSX.Element;
declare function ChicletSlicer({ options, value, defaultValue, onChange, multiple, label, className, disabled, }: OptionsSlicerProps): React.JSX.Element;
declare function TimelineSlicer({ value, defaultValue, onChange, label, className, disabled, minDate, maxDate, }: BaseProps & {
    value?: DateRange;
    defaultValue?: DateRange;
    onChange?: (value: DateRange) => void;
    minDate?: string;
    maxDate?: string;
}): React.JSX.Element;
declare function AdvancedDateSlicer({ label, className, rangeValue, rangeDefaultValue, onRangeChange, relativeValue, relativeDefaultValue, onRelativeChange, dateValue, dateDefaultValue, onDateChange, disabled, }: BaseProps & {
    rangeValue?: DateRange;
    rangeDefaultValue?: DateRange;
    onRangeChange?: (value: DateRange) => void;
    relativeValue?: string;
    relativeDefaultValue?: string;
    onRelativeChange?: (value: string) => void;
    dateValue?: string;
    dateDefaultValue?: string;
    onDateChange?: (value: string) => void;
}): React.JSX.Element;
declare function AdvancedHierarchySlicer({ options, value, defaultValue, onChange, label, className, disabled, searchPlaceholder, multiple, }: BaseProps & {
    options?: HierarchicalOption[];
    value?: string[];
    defaultValue?: string[];
    onChange?: (value: string[]) => void;
    searchPlaceholder?: string;
    multiple?: boolean;
}): React.JSX.Element;

export { AdvancedDateSlicer, AdvancedHierarchySlicer, BetweenSlicer, ButtonGrid, ButtonList, ButtonSlicer, type ButtonSlicerProps, ChicletSlicer, ConditionalListSlicer, ContainsFilter, DEFAULT_HIERARCHY_OPTIONS, DEFAULT_SLICER_OPTIONS, DateHierarchySlicer, DatePickerSlicer, type DateRange, DateRangeSlicer, type DateRangeSlicerProps, DropdownSlicer, ExactTextFilter, FreeFormInput, GreaterThanSlicer, HierarchicalListSlicer, type HierarchicalOption, HierarchicalSlicer, IconButtons, ImageButtons, InputCollection, InputSlicer, LessThanSlicer, ListSlicer, MultiSelectButtons, type NumericFilter, NumericInputFilter, type NumericRange, NumericRangeSlicer, type NumericRangeSlicerProps, NumericSlicer, type NumericSlicerProps, type OptionsSlicerProps, PastedValueFilter, type RelativeDatePreset, RelativeDateSlicer, RelativeTimeSlicer, SearchableListSlicer, SearchableSlicer, SingleSelectButtons, type SlicerOption, StandardSlicer, StartsWithFilter, type TextFilterProps, TileSlicer, TimelineSlicer, VerticalListSlicer };
