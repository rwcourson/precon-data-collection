/**
 * Field dictionary (BRD Sections 8–9), encoded once and introspected by the
 * post-bid entry form, Bid Schedule exports, and the custom report builder.
 */

export type FieldType =
  | "text"
  | "number"
  | "dollars"
  | "date"
  | "dropdown"
  | "multi";

export type FieldDef = {
  /** Column key on estimateRounds (or virtual key for job-level / multi fields). */
  key: string;
  label: string;
  type: FieldType;
  /** required = "Data Base Bid" (blank blocks approval); optional = "Data Alternate". */
  tier: "required" | "optional";
  /** Form section grouping. */
  group: string;
  /** Reference list key for dropdown/multi fields. */
  listKey?: string;
  /** External system that will eventually source this field (renders a badge + read-only styling hint). */
  source?: "connect" | "destini" | "buildingconnected";
  note?: string;
  /** Part of the Bid Schedule core set captured at pursuit creation. */
  core?: boolean;
  /** Only applies when Awardability indicates a Rate Only pricing round. */
  conditional?: "rateOnly";
};

export const FIELD_DEFS: FieldDef[] = [
  // ---- Identity / core bid schedule fields ----
  {
    key: "jobNumber",
    label: "Job Number",
    type: "text",
    tier: "required",
    group: "Project Identity",
    source: "connect",
    core: true,
    note: "Parent Job Number; may be unlinked pending Salesforce match",
  },
  {
    key: "jobName",
    label: "Job Name",
    type: "text",
    tier: "required",
    group: "Project Identity",
    source: "connect",
    core: true,
  },
  {
    key: "owner",
    label: "Owner",
    type: "text",
    tier: "optional",
    group: "Project Identity",
    core: true,
    note: "Bid-schedule Owner column — does not block RPD lock",
  },
  {
    key: "region",
    label: "Region",
    type: "dropdown",
    tier: "required",
    group: "Project Identity",
    listKey: "region",
    core: true,
    note: "Lead operational Division/Region if IJV",
  },
  {
    key: "preconDepartment",
    label: "Precon Department",
    type: "dropdown",
    tier: "required",
    group: "Project Identity",
    listKey: "preconDepartment",
    core: true,
    note: "Lead Preconstruction Department if IJV",
  },
  {
    key: "estimatePhase",
    label: "Estimate Phase",
    type: "dropdown",
    tier: "required",
    group: "Project Identity",
    listKey: "estimatePhase",
    core: true,
    note: "Identifies this Estimate Round",
  },
  {
    key: "bidYear",
    label: "Bid Year",
    type: "dropdown",
    tier: "required",
    group: "Project Identity",
    listKey: "bidYear",
    core: true,
  },
  {
    key: "drawingsDueDate",
    label: "Drawings Due",
    type: "date",
    tier: "optional",
    group: "Dates & Geography",
    core: true,
    note: "Operational Bid Schedule date — does not block RPD lock",
  },
  {
    key: "bidReviewDate",
    label: "Bid Review",
    type: "date",
    tier: "optional",
    group: "Dates & Geography",
    core: true,
    note: "Operational Bid Schedule date — does not block RPD lock",
  },
  {
    key: "bidDueDate",
    label: "Bid Due Date",
    type: "date",
    tier: "required",
    group: "Dates & Geography",
    core: true,
  },
  {
    key: "projectStartDate",
    label: "Project Start Date",
    type: "date",
    tier: "required",
    group: "Dates & Geography",
    core: true,
    note: "When construction starts",
  },
  {
    key: "city",
    label: "City",
    type: "text",
    tier: "required",
    group: "Dates & Geography",
    source: "connect",
    core: true,
  },
  {
    key: "state",
    label: "State",
    type: "text",
    tier: "required",
    group: "Dates & Geography",
    source: "connect",
    core: true,
  },
  {
    key: "estimateLead",
    label: "Estimate Lead",
    type: "text",
    tier: "required",
    group: "Project Identity",
    core: true,
  },
  {
    key: "mlt",
    label: "Market Leadership Team (MLT)",
    type: "dropdown",
    tier: "required",
    group: "Classification",
    listKey: "mlt",
    core: true,
  },
  {
    key: "marketSector",
    label: "Market Sector",
    type: "dropdown",
    tier: "required",
    group: "Classification",
    listKey: "marketSector",
    source: "connect",
    core: true,
  },
  {
    key: "contractType",
    label: "Contract Type",
    type: "dropdown",
    tier: "required",
    group: "Classification",
    listKey: "contractType",
    core: true,
  },
  {
    key: "procurement",
    label: "Procurement",
    type: "dropdown",
    tier: "required",
    group: "Classification",
    listKey: "procurement",
    core: true,
  },
  {
    key: "statusAtPricing",
    label: "Status",
    type: "dropdown",
    tier: "required",
    group: "Classification",
    listKey: "statusAtPricing",
    core: true,
    note: "At time of pricing: Prospective, Committed, or Work Under Contract",
  },

  // ---- Remaining required ("Data Base Bid") fields ----
  {
    key: "designContract",
    label: "Design Delivery",
    type: "dropdown",
    tier: "required",
    group: "Classification",
    listKey: "designContract",
    note: "Smartsheet label: Design Delivery",
  },
  {
    key: "internalJointVenture",
    label: "Internal Joint Venture",
    type: "dropdown",
    tier: "required",
    group: "Classification",
    listKey: "internalJointVenture",
    note: "Based on operational arrangement per the DMR; includes IJVs between Divisions in the same Region",
  },
  {
    key: "awardability",
    label: "Awardability",
    type: "dropdown",
    tier: "required",
    group: "Classification",
    listKey: "awardability",
    note: "Is this a Work Under Contract pricing round?",
  },
  {
    key: "businessStrategyValues",
    label: "Business Strategy Values",
    type: "dropdown",
    tier: "required",
    group: "Classification",
    listKey: "businessStrategyValues",
  },
  {
    key: "estimateValue",
    label: "Estimate Value $",
    type: "dollars",
    tier: "required",
    group: "Estimate Value & Fee",
    source: "destini",
    note: "Grand total price on the pursuit",
  },
  {
    key: "feeBackPage",
    label: "Fee – Back Page $",
    type: "dollars",
    tier: "required",
    group: "Estimate Value & Fee",
    source: "destini",
    note: "Fee stated on the back page of the estimate only",
  },
  {
    key: "feeExpected",
    label: "Fee – Expected $",
    type: "dollars",
    tier: "required",
    group: "Estimate Value & Fee",
    note: "All fee expected on the project (back page, rates, self-perform, etc.) — judgmental, not Destini",
  },
  {
    key: "contingencyTotal",
    label: "Contingency – Total $",
    type: "dollars",
    tier: "required",
    group: "Estimate Value & Fee",
    note: "All contingency included (back page, stated, internal, scope sheets, etc.) — hard-key until Destini fee-page sum is trusted",
  },
  {
    key: "craftLaborBase",
    label: "Craft Labor Base $",
    type: "dollars",
    tier: "required",
    group: "Labor",
    source: "destini",
  },
  {
    key: "craftLaborBurden",
    label: "Craft Labor Burden $",
    type: "dollars",
    tier: "required",
    group: "Labor",
    source: "destini",
  },
  {
    key: "craftLaborManHours",
    label: "Craft Labor Man Hours",
    type: "number",
    tier: "required",
    group: "Labor",
    source: "destini",
    note: "All craft labor manhours, incl. nested self-perform estimates",
  },
  {
    key: "gcBgSort",
    label: "GC $ – B&G Sort",
    type: "dollars",
    tier: "required",
    group: "General Conditions & Requirements",
    source: "destini",
    note: "B&G Cost Sort using Benchmark Component Code",
  },
  {
    key: "grBgSort",
    label: "GR $ – B&G Sort",
    type: "dollars",
    tier: "required",
    group: "General Conditions & Requirements",
    note: "Not Destini-checkmarked in 2026 markup — enter manually",
  },
  {
    key: "gcProposedOwnerSov",
    label: "GC $ Proposed – Owner SOV",
    type: "dollars",
    tier: "required",
    group: "General Conditions & Requirements",
    source: "destini",
    note: "GC cost that the Owner sees on the SOV",
  },
  {
    key: "grProposedOwnerSov",
    label: "GR $ Proposed – Owner SOV",
    type: "dollars",
    tier: "required",
    group: "General Conditions & Requirements",
    source: "destini",
  },
  {
    key: "pmMonths",
    label: "PM Months (APM to PD)",
    type: "number",
    tier: "required",
    group: "Staffing",
    source: "destini",
    note: "Total months, Assistant Project Manager through Project Director",
  },
  {
    key: "fieldSupervisionMonths",
    label: "Field Supervision Months (AFM to GS)",
    type: "number",
    tier: "required",
    group: "Staffing",
    source: "destini",
    note: "Total months, Assistant Field Manager through General Superintendent",
  },
  {
    key: "preconCost",
    label: "Precon Cost $ (in estimate)",
    type: "dollars",
    tier: "required",
    group: "Precon & Design",
    source: "destini",
    note: "Cost included in the estimate",
  },
  {
    key: "designCost",
    label: "Design Cost $ (in estimate)",
    type: "dollars",
    tier: "required",
    group: "Precon & Design",
    source: "destini",
    note: "Design consultants, design management, and/or construction engineering support",
  },
  {
    key: "selfPerformPriced",
    label: "Self-Perform $ Priced",
    type: "dollars",
    tier: "required",
    group: "Self-Perform",
    note: "Volume of self-perform work priced",
  },
  {
    key: "selfPerformProposed",
    label: "Self-Perform $ Proposed",
    type: "dollars",
    tier: "required",
    group: "Self-Perform",
    note: "Of the volume priced, how much was included in the proposal to the Owner",
  },
  {
    key: "selfPerformWorkType",
    label: "Self-Perform Work Type",
    type: "multi",
    tier: "required",
    group: "Self-Perform",
    listKey: "selfPerformWorkType",
    note: "What self-perform scope was priced (repeatable)",
  },
  {
    key: "projectScheduleDuration",
    label: "Project Schedule Duration (MO)",
    type: "number",
    tier: "required",
    group: "Schedule & Engagement",
    source: "destini",
    note: "Construction duration only",
  },
  {
    key: "projectPlanningPreconEngagement",
    label: "Project Planning Precon Engagement",
    type: "dropdown",
    tier: "required",
    group: "Schedule & Engagement",
    listKey: "projectPlanningPreconEngagement",
  },
  {
    key: "utilizedSupportServices",
    label: "Utilized Support Services",
    type: "multi",
    tier: "required",
    group: "Schedule & Engagement",
    listKey: "supportGroups",
    note: "What support departments helped with the preconstruction effort (repeatable)",
  },

  // ---- Optional ("Data Alternate") fields ----
  {
    key: "gsf",
    label: "GSF",
    type: "number",
    tier: "optional",
    group: "Project Attributes",
    source: "destini",
    note: "Total building GSF, including all buildings, parking, etc.",
  },
  {
    key: "hotelKeysUnits",
    label: "Hotel Keys / Apartment Units / Beds",
    type: "number",
    tier: "optional",
    group: "Project Attributes",
    source: "destini",
  },
  {
    key: "materials",
    label: "Materials $",
    type: "dollars",
    tier: "optional",
    group: "Additional Cost Types",
  },
  {
    key: "supplies",
    label: "Supplies $",
    type: "dollars",
    tier: "optional",
    group: "Additional Cost Types",
    note: "Defaults to $0 (not currently differentiated by B&G)",
  },
  {
    key: "equipment",
    label: "Equipment $",
    type: "dollars",
    tier: "optional",
    group: "Additional Cost Types",
  },
  {
    key: "equipmentOperation",
    label: "Equipment Operation $",
    type: "dollars",
    tier: "optional",
    group: "Additional Cost Types",
    note: "Defaults to $0 (not currently differentiated by B&G)",
  },
  {
    key: "subcontracted",
    label: "Subcontracted $",
    type: "dollars",
    tier: "optional",
    group: "Additional Cost Types",
  },
  {
    key: "marketOrStrategicRates",
    label: "Market or Strategic Rates",
    type: "dropdown",
    tier: "optional",
    group: "Market Engagement",
    listKey: "equipmentRates",
  },
  {
    key: "subQuotesReceived",
    label: "Sub Quotes Received (qty)",
    type: "number",
    tier: "optional",
    group: "Market Engagement",
    source: "buildingconnected",
    note: "From BuildingConnected — manual entry for now",
  },
  {
    key: "mwdbeSubQuotesReceived",
    label: "MWDBE Sub Quotes Received (qty)",
    type: "number",
    tier: "optional",
    group: "Market Engagement",
    source: "buildingconnected",
    note: "From BuildingConnected — manual entry for now",
  },
  {
    key: "mwdbeSubsPlugged",
    label: "MWDBE Subs Plugged ($)",
    type: "dollars",
    tier: "optional",
    group: "Market Engagement",
    source: "buildingconnected",
  },
  {
    key: "costOfWorkBasis",
    label: "Cost of Work Basis for Fee & GC's Proposals",
    type: "dollars",
    tier: "optional",
    group: "Other",
    conditional: "rateOnly",
    note: "Estimated future construction cost value for Rate Only procurement types",
  },
  {
    key: "afmMonths",
    label: "AFM Months",
    type: "number",
    tier: "optional",
    group: "Other",
    source: "destini",
  },
  {
    key: "peakManpowerHeadcount",
    label: "Peak Manpower Headcount",
    type: "number",
    tier: "optional",
    group: "Other",
    source: "destini",
  },
];

export const FIELD_MAP: Record<string, FieldDef> = Object.fromEntries(
  FIELD_DEFS.map((f) => [f.key, f])
);

/** Fields stored directly as columns on estimateRounds (excludes job-level + multi + virtual). */
export const ROUND_COLUMN_KEYS = FIELD_DEFS.filter(
  (f) =>
    f.type !== "multi" &&
    !["jobNumber", "jobName", "estimateLead"].includes(f.key)
).map((f) => f.key);

export const MULTI_FIELD_KEYS = FIELD_DEFS.filter(
  (f) => f.type === "multi"
).map((f) => f.key);

/** Required fields checked before a round can be RPD Approved / Locked. */
export const REQUIRED_FIELD_KEYS = FIELD_DEFS.filter(
  (f) => f.tier === "required"
).map((f) => f.key);

export const FIELD_GROUPS = [...new Set(FIELD_DEFS.map((f) => f.group))];

export const SOURCE_LABELS: Record<NonNullable<FieldDef["source"]>, string> = {
  connect: "B&G Connect",
  destini: "Destini",
  buildingconnected: "BuildingConnected",
};

export function isRateOnly(
  awardability: string | null | undefined,
  estimatePhase: string | null | undefined
): boolean {
  return (
    estimatePhase === "Rates Only" || (awardability ?? "").includes("Rate")
  );
}

/**
 * Conditional field logic (BRD Section 7). Evaluated identically on the client
 * (to show/hide inputs) and on the server (so the lock gate never demands a
 * field the form deliberately hid).
 */
export type ConditionContext = {
  awardability?: string | null;
  estimatePhase?: string | null;
  internalJointVenture?: string | null;
};

export function isInternalJointVenture(
  value: string | null | undefined
): boolean {
  const v = (value ?? "").trim();
  return v !== "" && v.toLowerCase() !== "none" && v.toLowerCase() !== "no";
}

export function conditionContextFrom(
  values: Record<string, unknown>
): ConditionContext {
  const str = (k: string) => {
    const v = values[k];
    return v == null ? null : String(v);
  };
  return {
    awardability: str("awardability"),
    estimatePhase: str("estimatePhase"),
    internalJointVenture: str("internalJointVenture"),
  };
}

/** True when a field's conditional trigger is satisfied (or it has no trigger). */
export function fieldApplies(def: FieldDef, ctx: ConditionContext): boolean {
  if (def.conditional === "rateOnly")
    return isRateOnly(ctx.awardability, ctx.estimatePhase);
  return true;
}

/** Keys hidden by conditional logic — excluded from required-field gating. */
export function inapplicableFieldKeys(ctx: ConditionContext): string[] {
  return FIELD_DEFS.filter((f) => !fieldApplies(f, ctx)).map((f) => f.key);
}

/** Extra guidance a field shows only because of how another field was answered. */
export function conditionalHint(
  key: string,
  ctx: ConditionContext
): string | null {
  const ijv = isInternalJointVenture(ctx.internalJointVenture);
  if (key === "region")
    return ijv
      ? "IJV — enter the lead operational Region for the arrangement."
      : null;
  if (key === "preconDepartment")
    return ijv ? "IJV — enter the lead Preconstruction Department." : null;
  if (key === "internalJointVenture")
    return ijv
      ? "Region and Precon Department must reflect the lead party per the DMR."
      : null;
  if (key === "costOfWorkBasis")
    return isRateOnly(ctx.awardability, ctx.estimatePhase)
      ? "Rate Only round — enter the estimated future construction cost the fee and GC rates are based on."
      : null;
  return null;
}
