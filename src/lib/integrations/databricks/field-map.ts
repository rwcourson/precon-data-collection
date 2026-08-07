/**
 * Live Databricks field map for the Precon Data Collection prototype.
 *
 * Probed against B&G Unity Catalog (warehouse used by the Pre-Con Time Tool).
 * This is a read-only inventory of what could feed Bid Schedule / post-bid /
 * dashboards — not a live connector yet.
 *
 * Key catalogs seen:
 *   domain.preconstruction.*          — Destini estimate domain tables
 *   domain.general.*                  — Build job master + team + org structure
 *   standardized.buildingconnected.*  — Autodesk BuildingConnected
 *   standardized.destiniestimates.*   — raw Destini estimate OLTP mirror
 *   standardized.sageestimates.*      — legacy Sage Estimating
 *   production.curated_tables.*       — curated potential awards, etc.
 *
 * Gap: no Salesforce Opportunity / B&G Connect pursuit pipeline tables were
 * found in UC under searchable names. Connect fields in the BRD still need a
 * Connect/Salesforce feed (or a future curated view).
 */

export type LiveFieldSource =
  | "destini_estimate"
  | "destini_metrics"
  | "destini_cost_items"
  | "build_project"
  | "build_team"
  | "division_structure"
  | "buildingconnected"
  | "potential_awards"
  | "self_perform"
  | "manual_only";

export type LiveFieldMap = {
  /** App / BRD field key */
  appField: string;
  label: string;
  /** Where live data can come from, if anywhere */
  source: LiveFieldSource;
  /** Fully-qualified column(s) */
  column?: string;
  notes?: string;
};

/** Highest-value live mappings confirmed by DESCRIBE + sample joins. */
export const LIVE_FIELD_MAP: LiveFieldMap[] = [
  // Identity / geography from Build (E1 / project master)
  {
    appField: "jobNumber",
    label: "Job Number",
    source: "build_project",
    column: "domain.general.buildprojectdetails.JobNumber",
  },
  {
    appField: "jobName",
    label: "Job Name",
    source: "build_project",
    column: "domain.general.buildprojectdetails.JobName",
  },
  {
    appField: "region",
    label: "Region",
    source: "build_project",
    column: "domain.general.buildprojectdetails.Region",
    notes: "Also map via division_structure_current.RegionName",
  },
  {
    appField: "preconDepartment",
    label: "Precon Department",
    source: "build_project",
    column: "domain.general.buildprojectdetails.Division",
    notes: "Division ≈ Precon Dept / operational unit; may need org mapping",
  },
  {
    appField: "city",
    label: "City",
    source: "build_project",
    column: "domain.general.buildprojectdetails.PhysicalCity",
  },
  {
    appField: "state",
    label: "State",
    source: "build_project",
    column: "domain.general.buildprojectdetails.PhysicalStateProvidenceAbbreviation",
  },
  {
    appField: "marketSector",
    label: "Market Sector",
    source: "build_project",
    column: "domain.general.buildprojectdetails.MarketSector",
  },
  {
    appField: "procurement",
    label: "Procurement",
    source: "build_project",
    column: "domain.general.buildprojectdetails.ProcurementMethod",
  },
  {
    appField: "contractType",
    label: "Contract Type",
    source: "build_project",
    column: "domain.general.buildprojectdetails.ContractDeliveryMethod",
  },
  {
    appField: "internalJointVenture",
    label: "Internal Joint Venture",
    source: "build_project",
    column: "domain.general.buildprojectdetails.IsIJV",
  },
  {
    appField: "projectStartDate",
    label: "Project Start Date",
    source: "build_project",
    column: "domain.general.buildprojectdetails.ConstructionStartDate",
    notes: "Destini also has ConstructionStartDate on the estimate",
  },
  {
    appField: "estimateLead",
    label: "Estimate Lead",
    source: "build_team",
    column: "domain.general.buildprojectteam.Role + EmployeeName",
    notes:
      "Filter Role IN ('Lead Precon Manager','Chief Preconstruction Manager','Team Preconstruction Manager')",
  },

  // Destini estimate round economics (~10.5k estimates)
  {
    appField: "estimateValue",
    label: "Estimate Value $",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.GrandTotalCost",
  },
  {
    appField: "feeBackPage",
    label: "Fee – Back Page $",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.StatedFee",
  },
  {
    appField: "contingencyTotal",
    label: "Contingency – Total $",
    source: "destini_estimate",
    column:
      "InternalContingency + StatedContingency on domain.preconstruction.destiniestimates",
  },
  {
    appField: "craftLaborBase",
    label: "Craft Labor Base $",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.LaborBase",
  },
  {
    appField: "craftLaborBurden",
    label: "Craft Labor Burden $",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.Burden",
  },
  {
    appField: "craftLaborManHours",
    label: "Craft Labor Man Hours",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.TotalManHours",
  },
  {
    appField: "gcBgSort",
    label: "GC $ – B&G Sort",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.GeneralConditions",
  },
  {
    appField: "grBgSort",
    label: "GR $ – B&G Sort",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.GeneralRequirements",
  },
  {
    appField: "pmMonths",
    label: "PM Months",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.PMMonths",
  },
  {
    appField: "fieldSupervisionMonths",
    label: "Field Supervision Months",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.SuperintendentMonths",
  },
  {
    appField: "projectScheduleDuration",
    label: "Project Schedule Duration (MO)",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.ScheduleDuration",
  },
  {
    appField: "gsf",
    label: "GSF",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.ProjectGSF",
  },
  {
    appField: "preconCost",
    label: "Precon Cost $ (in estimate)",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.DesignAndPrecon",
    notes: "Combined Design + Precon in Destini; may need cost-item split",
  },
  {
    appField: "estimatePhase",
    label: "Estimate Phase",
    source: "destini_estimate",
    column: "domain.preconstruction.destiniestimates.EstimateName",
    notes: "Parse from EstimateName (e.g. SD / DD / GMP) or Destini metadata",
  },

  // Calculated metrics already in lake (~same grain as estimates)
  {
    appField: "metric:feeExpectedPct",
    label: "Fee % (stated)",
    source: "destini_metrics",
    column: "domain.preconstruction.destinicalculatedmetrics.StatedFeePercentOfGrandTotalCost",
  },
  {
    appField: "metric:feePerPmMonth",
    label: "Fee per PM Month",
    source: "destini_metrics",
    column: "domain.preconstruction.destinicalculatedmetrics.StatedFeePerPMMonth",
  },
  {
    appField: "metric:costPerGsf",
    label: "$ / GSF",
    source: "destini_metrics",
    column: "domain.preconstruction.destinicalculatedmetrics.CostPerSF",
  },
  {
    appField: "metric:contingencyPct",
    label: "Contingency %",
    source: "destini_metrics",
    column: "domain.preconstruction.destinicalculatedmetrics.AllContingencyPercentOfCost",
  },

  // Self-perform / GC-GR from cost items
  {
    appField: "selfPerformPriced",
    label: "Self-Perform $ Priced",
    source: "destini_cost_items",
    column: "domain.preconstruction.destinicostitems (aggregate by CostType / BenchmarkComponent)",
    notes: "~2.8M cost items; also selfperform_estimates for SP-specific files",
  },
  {
    appField: "selfPerformWorkType",
    label: "Self-Perform Work Type",
    source: "self_perform",
    column: "domain.preconstruction.selfperform_estimates / destinicostitems.PhaseName",
  },

  // BuildingConnected (subcontractor bidding context)
  {
    appField: "bidDueDate",
    label: "Bid Due Date",
    source: "buildingconnected",
    column: "standardized.buildingconnected.projects.BidsDueAt",
    notes: "BC project grain; link to B&G job via Number / opportunity_project_pairs",
  },

  // Potential awards (win/loss adjacent)
  {
    appField: "outcome",
    label: "Outcome / award signal",
    source: "potential_awards",
    column: "production.curated_tables.potential_awards.ContractAmount + isClosed",
    notes: "Not a clean Successful/Unsuccessful enum; useful for award volume",
  },

  // Still manual / no UC table found
  {
    appField: "statusAtPricing",
    label: "Status at Pricing",
    source: "manual_only",
    notes: "No Connect/Salesforce opportunity table found in UC under this warehouse",
  },
  {
    appField: "mlt",
    label: "MLT",
    source: "manual_only",
  },
  {
    appField: "awardability",
    label: "Awardability",
    source: "manual_only",
  },
  {
    appField: "businessStrategyValues",
    label: "Business Strategy Values",
    source: "manual_only",
  },
  {
    appField: "feeExpected",
    label: "Fee – Expected $",
    source: "manual_only",
    notes: "Destini has StatedFee (back page); Expected fee still judgmental",
  },
  {
    appField: "gcProposedOwnerSov",
    label: "GC $ Proposed – Owner SOV",
    source: "manual_only",
  },
  {
    appField: "utilizedSupportServices",
    label: "Utilized Support Services",
    source: "manual_only",
  },
];

export const DATABRICKS_PROBE_SUMMARY = {
  warehouse: "B&G Azure Databricks SQL warehouse (shared with Pre-Con Time Tool)",
  tablesOfInterest: [
    { table: "domain.preconstruction.destiniestimates", rows: "~10.6k", role: "Estimate round economics" },
    { table: "domain.preconstruction.destinicalculatedmetrics", rows: "~10.6k", role: "Pre-computed fee/GC/GR/$SF metrics" },
    { table: "domain.preconstruction.destinicostitems", rows: "~2.8M", role: "Line items for GC/GR/SP sorts" },
    { table: "domain.general.buildprojectdetails", rows: "~36k", role: "Job master (region, sector, city, contract)" },
    { table: "domain.general.buildprojectteam", rows: "~248k", role: "Estimate Lead / RPD / PCM roster" },
    { table: "domain.general.division_structure_current", rows: "52", role: "Region ↔ Division reference" },
    { table: "standardized.buildingconnected.projects", rows: "~6.3k", role: "Bid due dates, BC project metadata" },
    { table: "production.curated_tables.potential_awards", rows: "~1.8k", role: "Award/bid outcomes adjacent" },
  ],
  joinKey: "ParentJobNumber / JobNumber",
  notFound: [
    "Salesforce Opportunity / B&G Connect pursuit pipeline tables",
    "SmartSheet Precon Pursuits export tables",
  ],
} as const;
