import * as React from 'react';

type ReportPaperPreset = "letter-portrait" | "letter-landscape" | "legal-portrait";
type ReportMargins = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
/** Physical measurements are expressed in PDF/PostScript points (72 points per inch). */
type ReportPageSpec = {
    name: string;
    width: number;
    height: number;
    margins: ReportMargins;
    headerHeight: number;
    footerHeight: number;
    columnHeaderHeight: number;
    rowHeight: number;
    groupHeaderHeight: number;
    subtotalHeight: number;
};
type PaginatedReportRow = {
    id: string;
    group: string;
    subgroup?: string;
    label: string;
    quantity: number;
    amount: number;
    date?: string;
    href?: string;
};
type ReportSupplementKind = "chart" | "matrix" | "subreport" | "filter-summary" | "document-map" | "note";
type ReportSupplement = {
    id: string;
    kind: ReportSupplementKind;
    title: string;
    description: string;
    height: number;
    values?: readonly number[];
};
type ReportSortMode = "input" | "group-label" | "amount-desc";
type ReportPaginationOptions = {
    page: ReportPageSpec;
    repeatColumnHeaders?: boolean;
    showColumnHeaders?: boolean;
    showGroupHeaders?: boolean;
    showSubgroupHeaders?: boolean;
    showSubtotals?: boolean;
    showGrandTotal?: boolean;
    showRunningTotals?: boolean;
    includeDetailRows?: boolean;
    keepGroupsTogether?: boolean;
    breakBetweenGroups?: boolean;
    minimumRowsAfterGroupHeader?: number;
    columnsPerPage?: 1 | 2;
    sortMode?: ReportSortMode;
    breakBeforeRowIds?: readonly string[];
    breakBeforeGroups?: readonly string[];
    supplements?: readonly ReportSupplement[];
    filter?: (row: PaginatedReportRow) => boolean;
};
type ReportBlockBase = {
    id: string;
    height: number;
};
type ReportColumnHeaderBlock = ReportBlockBase & {
    kind: "column-header";
    repeated: boolean;
};
type ReportGroupHeaderBlock = ReportBlockBase & {
    kind: "group-header" | "subgroup-header";
    label: string;
    level: 1 | 2;
};
type ReportDataRowBlock = ReportBlockBase & {
    kind: "row";
    row: PaginatedReportRow;
    runningTotal: number;
};
type ReportTotalBlock = ReportBlockBase & {
    kind: "subtotal" | "grand-total";
    label: string;
    quantity: number;
    amount: number;
};
type ReportSupplementBlock = ReportBlockBase & {
    kind: "supplement";
    supplement: ReportSupplement;
};
type ReportFlowBlock = ReportColumnHeaderBlock | ReportGroupHeaderBlock | ReportDataRowBlock | ReportTotalBlock | ReportSupplementBlock;
type ReportPageColumn = {
    index: number;
    blocks: readonly ReportFlowBlock[];
    usedHeight: number;
    availableHeight: number;
};
type PaginatedReportPage = {
    index: number;
    columns: readonly ReportPageColumn[];
};
type PaginatedReportLayout = {
    page: ReportPageSpec;
    pages: readonly PaginatedReportPage[];
    /** Filtered and deterministically ordered detail stream used to build the pages. */
    flowRows: readonly PaginatedReportRow[];
    rowCount: number;
    filteredRowCount: number;
    totalQuantity: number;
    totalAmount: number;
    columnsPerPage: 1 | 2;
};
type ReportPaginationResult = {
    ok: true;
    data: PaginatedReportLayout;
} | {
    ok: false;
    message: string;
};
declare const REPORT_PAGE_PRESETS: {
    readonly "letter-portrait": {
        readonly name: "US Letter portrait";
        readonly width: 612;
        readonly height: 792;
        readonly margins: {
            readonly top: 36;
            readonly right: 36;
            readonly bottom: 36;
            readonly left: 36;
        };
        readonly headerHeight: 36;
        readonly footerHeight: 28;
        readonly columnHeaderHeight: 24;
        readonly rowHeight: 24;
        readonly groupHeaderHeight: 24;
        readonly subtotalHeight: 24;
    };
    readonly "letter-landscape": {
        readonly name: "US Letter landscape";
        readonly width: 792;
        readonly height: 612;
        readonly margins: {
            readonly top: 30;
            readonly right: 36;
            readonly bottom: 30;
            readonly left: 36;
        };
        readonly headerHeight: 34;
        readonly footerHeight: 26;
        readonly columnHeaderHeight: 22;
        readonly rowHeight: 22;
        readonly groupHeaderHeight: 22;
        readonly subtotalHeight: 22;
    };
    readonly "legal-portrait": {
        readonly name: "US Legal portrait";
        readonly width: 612;
        readonly height: 1008;
        readonly margins: {
            readonly top: 36;
            readonly right: 36;
            readonly bottom: 36;
            readonly left: 36;
        };
        readonly headerHeight: 36;
        readonly footerHeight: 28;
        readonly columnHeaderHeight: 24;
        readonly rowHeight: 24;
        readonly groupHeaderHeight: 24;
        readonly subtotalHeight: 24;
    };
};
declare function createReportPageSpec(preset?: ReportPaperPreset, overrides?: Partial<Omit<ReportPageSpec, "margins">> & {
    margins?: Partial<ReportMargins>;
}): ReportPageSpec;
declare function paginateReport(rows: readonly PaginatedReportRow[], options: ReportPaginationOptions): ReportPaginationResult;

declare const DEFAULT_PAGINATED_REPORT_ROWS: {
    id: string;
    group: "North" | "South" | "West" | "Central";
    subgroup: "Field" | "Enterprise";
    label: "Atlas Manufacturing" | "Beacon Health" | "Crescent Retail" | "Delta Services" | "Evergreen Foods" | "Foundry Logistics";
    quantity: number;
    amount: number;
    date: string;
    href: string;
}[];

type PaginatedReportVariant = "page-measurement" | "explicit-page-breaks" | "repeated-table-headers" | "group-headers" | "nested-groups" | "group-subtotals" | "grand-total" | "running-totals" | "page-numbers" | "first-last-page-sections" | "keep-groups-together" | "orphan-control" | "nested-data-regions" | "subreport-region" | "chart-data-region" | "table-data-region" | "matrix-data-region" | "list-data-region" | "two-column-flow" | "letter-landscape" | "legal-portrait" | "custom-page-size" | "print-margin-guide" | "report-header-footer" | "conditional-group-breaks" | "deterministic-sort-group" | "parameter-filter-summary" | "document-map" | "drillthrough-links" | "monochrome-print-style" | "pdf-export-layout-preview" | "accessible-reading-order";
type ReportBodyPresentation = "table" | "list";
type ReportVariantPresentation = {
    body: ReportBodyPresentation;
    showPageNumbers?: boolean;
    showMeasurement?: boolean;
    showMarginGuides?: boolean;
    showDocumentMap?: boolean;
    showDrillthrough?: boolean;
    emphasizeReadingOrder?: boolean;
    firstLastSections?: boolean;
    detailedHeaderFooter?: boolean;
    monochrome?: boolean;
    exportLayoutPreview?: boolean;
};
type PaginatedReportVariantDefinition = {
    variant: PaginatedReportVariant;
    title: string;
    description: string;
    page: ReportPageSpec;
    pagination: Omit<ReportPaginationOptions, "page">;
    presentation: ReportVariantPresentation;
};
declare const PAGINATED_REPORT_VARIANTS: readonly PaginatedReportVariantDefinition[];
declare function getPaginatedReportVariant(variant: PaginatedReportVariant): PaginatedReportVariantDefinition | undefined;

type PaginatedReportProps = {
    className?: string;
    variant?: PaginatedReportVariant;
    rows?: readonly PaginatedReportRow[];
    title?: string;
    description?: string;
    page?: ReportPageSpec;
    pagination?: Partial<Omit<ReportPaginationOptions, "page">>;
    maxPreviewPages?: number;
    locale?: string;
    currency?: string;
};
declare function PaginatedReport({ className, variant, rows, title, description, page, pagination, maxPreviewPages, locale, currency, }?: PaginatedReportProps): React.JSX.Element;

export { DEFAULT_PAGINATED_REPORT_ROWS, PAGINATED_REPORT_VARIANTS, PaginatedReport, type PaginatedReportLayout, type PaginatedReportPage, type PaginatedReportProps, type PaginatedReportRow, type PaginatedReportVariant, type PaginatedReportVariantDefinition, REPORT_PAGE_PRESETS, type ReportBodyPresentation, type ReportColumnHeaderBlock, type ReportDataRowBlock, type ReportFlowBlock, type ReportGroupHeaderBlock, type ReportMargins, type ReportPageColumn, type ReportPageSpec, type ReportPaginationOptions, type ReportPaginationResult, type ReportPaperPreset, type ReportSortMode, type ReportSupplement, type ReportSupplementBlock, type ReportSupplementKind, type ReportTotalBlock, type ReportVariantPresentation, createReportPageSpec, getPaginatedReportVariant, paginateReport };
