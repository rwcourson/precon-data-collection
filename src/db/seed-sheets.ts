/**
 * Rebuilds B&G's Smartsheet workspace as sheets in this app.
 *
 * Every sheet in the export becomes a sheet here, in the same folder, under
 * the same name. The ones that were slices of pursuit data become live views —
 * "CEN CBG Bid Schedule - Active" is now a filter on the one record set rather
 * than its own copy — and the ones that were never pursuit data (rosters, cost
 * tracking, dashboard backing tables) come across as standalone grids with
 * their columns and rows intact.
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "./index";
import {
  estimateRounds,
  type SheetColumnType,
  type SheetFilter,
  type SheetViewConfig,
  sheetColumns,
  sheetRows,
  sheets,
} from "./schema";

const REGION_BY_PREFIX: Record<string, string | null> = {
  "00": null,
  CAR: "Carolinas",
  CEN: "Central",
  FL: "Florida",
  GA: "Georgia",
  TX: "Texas",
};

/** Column titles a source sheet may use for the business unit. */
const DIVISION_TITLES = ["Division", "Precon Dept", "Precon Department"];

const BID_SCHEDULE_COLUMNS = [
  "jobNumber",
  "jobName",
  "estimatePhase",
  "bidYear",
  "bidDueDate",
  "city",
  "estimateLead",
  "estimateValue",
  "status",
];

const POST_BID_COLUMNS = [
  "jobNumber",
  "jobName",
  "estimatePhase",
  "bidDueDate",
  "estimateLead",
  "outcome",
  "estimateValue",
  "feeExpected",
  "contingencyTotal",
  "craftLaborBase",
  "gcBgSort",
  "grBgSort",
  "status",
];

/** The required post-bid fields, so a blank cell is the checklist item. */
const CHECKLIST_COLUMNS = [
  "jobNumber",
  "jobName",
  "estimateLead",
  "outcome",
  "awardability",
  "internalJointVenture",
  "estimateValue",
  "feeBackPage",
  "feeExpected",
  "contingencyTotal",
  "craftLaborBase",
  "craftLaborBurden",
  "craftLaborManHours",
  "pmMonths",
  "fieldSupervisionMonths",
  "preconCost",
  "projectScheduleDuration",
  "status",
];

const METRICS_COLUMNS = [
  "jobNumber",
  "jobName",
  "preconDepartment",
  "estimatePhase",
  "marketSector",
  "contractType",
  "estimateValue",
  "metric:feeExpectedPct",
  "metric:feeBackPagePct",
  "metric:contingencyPct",
  "metric:gcGrCombinedPct",
  "metric:craftLaborPctOfEstimate",
  "metric:laborCostPerManHour",
  "metric:preconCostPct",
  "metric:costPerGsf",
  "metric:selfPerformPricedPct",
];

const SELF_PERFORM_COLUMNS = [
  "jobNumber",
  "jobName",
  "preconDepartment",
  "estimatePhase",
  "estimateValue",
  "selfPerformPriced",
  "selfPerformProposed",
  "selfPerformWorkType",
  "metric:selfPerformPricedPct",
  "metric:selfPerformProposedPct",
  "metric:selfPerformCapture",
  "metric:craftLaborPctOfEstimate",
];

type Classified = {
  kind: "view" | "grid";
  config?: SheetViewConfig;
  description: string;
};

function statusFilter(values: string[]): SheetFilter {
  return { field: "status", op: "in", value: values.join(", ") };
}

function classify(
  name: string,
  region: string | null,
  divisions: string[]
): Classified {
  const base: SheetFilter[] = [];
  if (region) base.push({ field: "region", op: "eq", value: region });
  if (divisions.length > 0)
    base.push({
      field: "preconDepartment",
      op: "in",
      value: divisions.join(", "),
    });

  /** "CEN CBG Bid Schedule" covers AL HLC, AL MED, N AL… — say which. */
  const scope = divisions.length > 0 ? ` Covers ${divisions.join(", ")}.` : "";

  if (/Bid Schedule/i.test(name)) {
    const wanted: string[] = [];
    if (/active/i.test(name)) wanted.push("Active");
    if (/upcoming/i.test(name)) wanted.push("Upcoming");
    if (/outstanding/i.test(name)) wanted.push("Outstanding");
    return {
      kind: "view",
      description:
        "Pursuits in the bid schedule for this division. Status changes here move the record through the workflow." +
        scope,
      config: {
        columns: BID_SCHEDULE_COLUMNS,
        filters: [
          ...base,
          statusFilter(
            wanted.length ? wanted : ["Active", "Upcoming", "Outstanding"]
          ),
        ],
        sortBy: [{ field: "bidDueDate", dir: "asc" }],
        groupBy: [],
      },
    };
  }

  if (/Post Bid Checklist/i.test(name)) {
    return {
      kind: "view",
      description:
        "Post-bid completeness at a glance — every required field is a column, so a blank cell is the outstanding item." +
        scope,
      config: {
        columns: CHECKLIST_COLUMNS,
        filters: [...base, statusFilter(["Submitted", "Post-Bid Data Entry"])],
        sortBy: [{ field: "bidDueDate", dir: "asc" }],
        groupBy: [],
      },
    };
  }

  if (/Post Bid Data Collection/i.test(name)) {
    return {
      kind: "view",
      description: `Estimates that have bid and are collecting post-bid data.${scope}`,
      config: {
        columns: POST_BID_COLUMNS,
        filters: [
          ...base,
          statusFilter([
            "Submitted",
            "Post-Bid Data Entry",
            "RPD Approved / Locked",
          ]),
        ],
        sortBy: [{ field: "bidDueDate", dir: "desc" }],
        groupBy: [],
      },
    };
  }

  if (/Self Perform/i.test(name) && /Metrics Capture/i.test(name)) {
    return {
      kind: "view",
      description: `Estimates carrying self-perform scope, with capture rates.${scope}`,
      config: {
        columns: SELF_PERFORM_COLUMNS,
        filters: [
          ...base,
          { field: "selfPerformPriced", op: "notblank", value: "" },
        ],
        sortBy: [{ field: "estimateValue", dir: "desc" }],
        groupBy: [],
      },
    };
  }

  if (/Metrics Capture/i.test(name)) {
    return {
      kind: "view",
      description:
        "The full metric set for the year — every calculated column derives from the record, so there is nothing to recompute by hand." +
        scope,
      config: {
        columns: METRICS_COLUMNS,
        filters: base,
        sortBy: [{ field: "estimateValue", dir: "desc" }],
        groupBy: [],
      },
    };
  }

  if (/Consolidated Metrics/i.test(name)) {
    return {
      kind: "view",
      description: `Region rollup by Precon Department, subtotalled in place.${scope}`,
      config: {
        columns: METRICS_COLUMNS,
        filters: base,
        sortBy: [{ field: "estimateValue", dir: "desc" }],
        groupBy: ["preconDepartment"],
      },
    };
  }

  return {
    kind: "grid",
    description: "Migrated from Smartsheet with its own columns and rows.",
  };
}

type SmartsheetColumn = {
  id: number;
  title: string;
  type?: string;
  options?: string[];
};

type SmartsheetRow = {
  cells?: { columnId: number; value?: unknown; displayValue?: string }[];
};

function cellText(
  cell: { value?: unknown; displayValue?: string } | undefined
): string | null {
  const raw = cell?.displayValue ?? cell?.value ?? null;
  if (raw == null || typeof raw === "object") return null;
  const text = String(raw).trim();
  return text === "" ? null : text;
}

function columnType(
  col: SmartsheetColumn,
  values: (string | null)[]
): SheetColumnType {
  switch (col.type) {
    case "DATE":
    case "DATETIME":
      return "date";
    case "CHECKBOX":
      return "checkbox";
    case "CONTACT_LIST":
      return "contact";
    case "PICKLIST":
      return "dropdown";
    default:
      break;
  }
  const present = values.filter((v): v is string => v != null);
  const numeric =
    present.length > 0 &&
    present.every((v) => Number.isFinite(Number(v.replace(/[$,%\s]/g, ""))));
  if (!numeric) return "text";
  return /(\$|cost|value|amount|fee|revenue|price|budget)/i.test(col.title)
    ? "dollars"
    : "number";
}

/**
 * The business units a source sheet actually covered. B&G names its sheets by
 * division ("CEN CBG Bid Schedule"), but the division codes inside are legacy
 * business units — AL HLC, N AL, AL/MS COM — that no name-to-department guess
 * would ever reproduce. Reading them off the sheet's own rows makes the
 * migrated filter exactly as wide as the sheet it replaces.
 */
function divisionCodes(
  columns: SmartsheetColumn[],
  rows: SmartsheetRow[]
): string[] {
  const col = columns.find((c) =>
    DIVISION_TITLES.some(
      (t) => t.toLowerCase() === c.title.trim().toLowerCase()
    )
  );
  if (!col) return [];
  const found = new Set<string>();
  for (const row of rows) {
    const text = cellText((row.cells ?? []).find((c) => c.columnId === col.id));
    if (text) found.add(text);
  }
  return [...found].sort();
}

/** "CAR_Precon_Data_CAR_Estimate_Summary_Data" → "CAR Estimate Summary Data". */
function folderFromPath(segment: string): string {
  return segment
    .replace(/^\d+_Corporate_Precon_/, "")
    .replace(/^[A-Z]+_Precon_Data_/, "")
    .replace(/_/g, " ")
    .trim();
}

type RoundFacts = { region: string; preconDepartment: string; status: string };

/**
 * Safety net for sheets whose export carries no usable division column: the
 * generated filter set is tested against the real records and the narrowest
 * predicate is dropped until the sheet has something in it, so a migration
 * never lands a sheet that silently matches nothing.
 */
function relaxToNonEmpty(
  filters: SheetFilter[],
  facts: RoundFacts[]
): SheetFilter[] {
  const matches = (set: SheetFilter[]) =>
    facts.some((f) =>
      set.every((filter) => {
        const value =
          (f as unknown as Record<string, string>)[filter.field] ?? "";
        const needle = filter.value.toLowerCase();
        if (filter.op === "in")
          return needle
            .split(",")
            .map((s) => s.trim())
            .includes(value.toLowerCase());
        if (filter.op === "contains")
          return value.toLowerCase().includes(needle);
        if (filter.op === "notblank") return value !== "";
        return value.toLowerCase() === needle;
      })
    );

  if (matches(filters)) return filters;

  const withoutDepartment = filters.filter(
    (f) => f.field !== "preconDepartment"
  );
  if (withoutDepartment.length !== filters.length && matches(withoutDepartment))
    return withoutDepartment;

  const regionOnly = withoutDepartment.filter((f) => f.field === "region");
  return matches(regionOnly) ? regionOnly : [];
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  upcoming: "Upcoming",
  outstanding: "Outstanding",
  submitted: "Submitted",
  post_bid: "Post-Bid Data Entry",
  locked: "RPD Approved / Locked",
};

export async function seedSheetsFromExport(dataDir: string): Promise<{
  views: number;
  grids: number;
  rows: number;
}> {
  if (!fs.existsSync(dataDir)) return { views: 0, grids: 0, rows: 0 };

  const facts: RoundFacts[] = (
    await db
      .select({
        region: estimateRounds.region,
        preconDepartment: estimateRounds.preconDepartment,
        status: estimateRounds.status,
        selfPerformPriced: estimateRounds.selfPerformPriced,
      })
      .from(estimateRounds)
  ).map((r) => ({
    region: r.region,
    preconDepartment: r.preconDepartment,
    status: STATUS_LABEL[r.status] ?? r.status,
    selfPerformPriced:
      r.selfPerformPriced == null ? "" : String(r.selfPerformPriced),
  }));

  await db.delete(sheetRows);
  await db.delete(sheetColumns);
  await db.delete(sheets);

  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  let views = 0;
  let grids = 0;
  let rowTotal = 0;

  for (const file of files) {
    const raw = JSON.parse(
      fs.readFileSync(path.join(dataDir, file), "utf8")
    ) as {
      name?: string;
      columns?: SmartsheetColumn[];
      rows?: SmartsheetRow[];
    };
    const parts = file.replace(/\.json$/, "").split("__");
    const prefix = parts[0]?.split("_")[0] ?? "";
    const region = prefix in REGION_BY_PREFIX ? REGION_BY_PREFIX[prefix] : null;
    const folder = folderFromPath(parts[0] ?? "General") || "General";
    const name = raw.name ?? (parts[1] ?? file).replace(/_/g, " ");

    const { kind, config, description } = classify(
      name,
      region,
      divisionCodes(raw.columns ?? [], raw.rows ?? [])
    );
    const resolved = config
      ? { ...config, filters: relaxToNonEmpty(config.filters, facts) }
      : null;
    const [created] = await db
      .insert(sheets)
      .values({
        kind,
        name,
        description,
        region,
        folder,
        config: resolved,
        sourceSheet: name,
      })
      .returning({ id: sheets.id });

    if (kind === "view") {
      views++;
      continue;
    }

    grids++;
    const cols = raw.columns ?? [];
    const sourceRows = raw.rows ?? [];
    const valuesByColumn = new Map<number, (string | null)[]>();
    for (const col of cols) valuesByColumn.set(col.id, []);
    for (const row of sourceRows) {
      const byId = new Map((row.cells ?? []).map((c) => [c.columnId, c]));
      for (const col of cols)
        valuesByColumn.get(col.id)!.push(cellText(byId.get(col.id)));
    }

    const keyByColumnId = new Map<number, string>();
    const taken: string[] = [];
    const columnValues = cols.map((col, index) => {
      const key =
        col.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 40) || `column_${index + 1}`;
      const unique = taken.includes(key) ? `${key}_${index + 1}` : key;
      taken.push(unique);
      keyByColumnId.set(col.id, unique);
      const type = columnType(col, valuesByColumn.get(col.id) ?? []);
      return {
        sheetId: created.id,
        key: unique,
        label: col.title,
        type,
        options: type === "dropdown" ? (col.options ?? []) : null,
        width: type === "text" ? 180 : 130,
        sortOrder: index,
      };
    });
    if (columnValues.length > 0)
      await db.insert(sheetColumns).values(columnValues);

    const rowValues = sourceRows
      .map((row, index) => {
        const byId = new Map((row.cells ?? []).map((c) => [c.columnId, c]));
        const values: Record<string, string | null> = {};
        for (const col of cols) {
          const text = cellText(byId.get(col.id));
          if (text != null) values[keyByColumnId.get(col.id)!] = text;
        }
        return { sheetId: created.id, values, sortOrder: index };
      })
      .filter((r) => Object.keys(r.values).length > 0);

    for (let i = 0; i < rowValues.length; i += 250) {
      const chunk = rowValues.slice(i, i + 250);
      if (chunk.length > 0) await db.insert(sheetRows).values(chunk);
    }
    rowTotal += rowValues.length;
  }

  return { views, grids, rows: rowTotal };
}
