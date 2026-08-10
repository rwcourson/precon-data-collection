import * as React from 'react';
import { ReactNode, Key } from 'react';

type TableCellValue = string | number | readonly number[] | null | undefined;
type TableRow = Record<string, TableCellValue>;
type TableValueFormatter = (value: TableCellValue, row: TableRow) => ReactNode;
type TableColumn = {
    key: string;
    label: string;
    numeric?: boolean;
    format?: "number" | "percent" | "text" | TableValueFormatter;
    imageAlt?: string | ((row: TableRow) => string);
    linkLabel?: string | ((row: TableRow) => string);
    render?: TableValueFormatter;
};
type DataTableProps = {
    columns: TableColumn[];
    rows: TableRow[];
    rowId?: string | ((row: TableRow, index: number) => Key);
    locale?: string;
    showTotals?: boolean;
    conditionalBackground?: boolean;
    conditionalFont?: boolean;
    showIcons?: boolean;
    showDataBars?: boolean;
    linkKeys?: string[];
    imageKeys?: string[];
    sparklineKey?: string;
    onRowSelect?: (row: TableRow, index: number) => void;
    selectedRowIds?: ReadonlySet<Key>;
    /** Rendered as a visually hidden <caption> and used as the table's accessible name. */
    caption?: string;
};
declare function DataTable({ columns, rows, rowId, locale, showTotals, conditionalBackground, conditionalFont, showIcons, showDataBars, linkKeys, imageKeys, sparklineKey, onRowSelect, selectedRowIds, caption, }: DataTableProps): React.JSX.Element;
type MatrixRow = {
    id?: string;
    children?: MatrixRow[];
    [key: string]: string | number | MatrixRow[] | null | undefined;
};
type MatrixTableProps = {
    rows: MatrixRow[];
    rowKey: string;
    columns: string[];
    showSubtotals?: boolean;
    showGrandTotal?: boolean;
    caption?: string;
    expandedIds?: ReadonlySet<string>;
    defaultExpandedIds?: Iterable<string>;
    onExpandedChange?: (expandedIds: ReadonlySet<string>) => void;
};
declare function MatrixTable({ rows, rowKey, columns, showSubtotals, showGrandTotal, caption, expandedIds, defaultExpandedIds, onExpandedChange, }: MatrixTableProps): React.JSX.Element;

export { DataTable, type DataTableProps, type MatrixRow, MatrixTable, type MatrixTableProps, type TableCellValue, type TableColumn, type TableRow, type TableValueFormatter };
