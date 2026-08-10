import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roundStatusEnum = pgEnum("round_status", [
  "active",
  "upcoming",
  "outstanding",
  "submitted",
  "post_bid",
  "locked",
]);

export const outcomeEnum = pgEnum("outcome", [
  "pending",
  "successful",
  "unsuccessful",
]);

export const roleEnum = pgEnum("role", [
  "pcm",
  "estimate_lead",
  "admin_jsa",
  "rpd",
  "leadership",
  "corporate_admin",
]);

export const columnScopeEnum = pgEnum("column_scope", ["company", "region"]);

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "number",
  "dollars",
  "date",
  "dropdown",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  role: roleEnum("role").notNull(),
  region: text("region"),
  preconDepartment: text("precon_department"),
  email: text("email").notNull(),
});

/** Mock B&G Connect / Salesforce jobs used for lookup + match-and-merge. */
export const salesforceJobs = pgTable("salesforce_jobs", {
  id: serial("id").primaryKey(),
  sfId: text("sf_id").notNull(),
  jobNumber: text("job_number").notNull(),
  jobName: text("job_name").notNull(),
  region: text("region").notNull(),
  marketSector: text("market_sector"),
  city: text("city"),
  state: text("state"),
  createdDate: date("created_date"),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  /** Real Job Number when linked; placeholder (e.g. "TBD-1042") when manual/unlinked. */
  jobNumber: text("job_number").notNull(),
  jobName: text("job_name").notNull(),
  region: text("region").notNull(),
  preconDepartment: text("precon_department").notNull(),
  salesforceId: text("salesforce_id"),
  isLinked: boolean("is_linked").notNull().default(false),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  deletedById: integer("deleted_by_id").references(() => users.id),
  deletionBatchId: integer("deletion_batch_id"),
});

export const estimateRounds = pgTable("estimate_rounds", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id),
  roundNumber: integer("round_number").notNull(),
  status: roundStatusEnum("status").notNull().default("upcoming"),
  outcome: outcomeEnum("outcome").notNull().default("pending"),

  // ---- Core Bid Schedule fields (the "16 core data points") ----
  region: text("region").notNull(),
  preconDepartment: text("precon_department").notNull(),
  estimatePhase: text("estimate_phase").notNull(),
  bidYear: integer("bid_year").notNull(),
  bidDueDate: date("bid_due_date"),
  projectStartDate: date("project_start_date"),
  city: text("city"),
  state: text("state"),
  estimateLeadId: integer("estimate_lead_id").references(() => users.id),
  mlt: text("mlt"),
  marketSector: text("market_sector"),
  contractType: text("contract_type"),
  procurement: text("procurement"),
  designContract: text("design_contract"),
  statusAtPricing: text("status_at_pricing"),

  // ---- Required post-bid fields ("Data Base Bid") ----
  internalJointVenture: text("internal_joint_venture"),
  awardability: text("awardability"),
  businessStrategyValues: text("business_strategy_values"),
  estimateValue: doublePrecision("estimate_value"),
  feeBackPage: doublePrecision("fee_back_page"),
  feeExpected: doublePrecision("fee_expected"),
  contingencyTotal: doublePrecision("contingency_total"),
  craftLaborBase: doublePrecision("craft_labor_base"),
  craftLaborBurden: doublePrecision("craft_labor_burden"),
  craftLaborManHours: doublePrecision("craft_labor_man_hours"),
  gcBgSort: doublePrecision("gc_bg_sort"),
  grBgSort: doublePrecision("gr_bg_sort"),
  gcProposedOwnerSov: doublePrecision("gc_proposed_owner_sov"),
  grProposedOwnerSov: doublePrecision("gr_proposed_owner_sov"),
  pmMonths: doublePrecision("pm_months"),
  fieldSupervisionMonths: doublePrecision("field_supervision_months"),
  preconCost: doublePrecision("precon_cost"),
  designCost: doublePrecision("design_cost"),
  selfPerformPriced: doublePrecision("self_perform_priced"),
  selfPerformProposed: doublePrecision("self_perform_proposed"),
  projectScheduleDuration: doublePrecision("project_schedule_duration"),
  projectPlanningPreconEngagement: text("project_planning_precon_engagement"),

  // ---- Optional / Data Alternate fields ----
  gsf: doublePrecision("gsf"),
  hotelKeysUnits: doublePrecision("hotel_keys_units"),
  materials: doublePrecision("materials"),
  supplies: doublePrecision("supplies"),
  equipment: doublePrecision("equipment"),
  equipmentOperation: doublePrecision("equipment_operation"),
  subcontracted: doublePrecision("subcontracted"),
  marketOrStrategicRates: text("market_or_strategic_rates"),
  subQuotesReceived: doublePrecision("sub_quotes_received"),
  mwdbeSubQuotesReceived: doublePrecision("mwdbe_sub_quotes_received"),
  mwdbeSubsPlugged: doublePrecision("mwdbe_subs_plugged"),
  costOfWorkBasis: doublePrecision("cost_of_work_basis"),
  afmMonths: doublePrecision("afm_months"),
  peakManpowerHeadcount: doublePrecision("peak_manpower_headcount"),

  submittedAt: timestamp("submitted_at"),
  lockedAt: timestamp("locked_at"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  deletedById: integer("deleted_by_id").references(() => users.id),
  deletionBatchId: integer("deletion_batch_id"),
});

/** Repeatable one-to-many fields (Self-Perform Work Type, Utilized Support Services). */
export const roundMultiValues = pgTable("round_multi_values", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id")
    .notNull()
    .references(() => estimateRounds.id),
  field: text("field").notNull(), // "selfPerformWorkType" | "utilizedSupportServices"
  value: text("value").notNull(),
});

export const referenceLists = pgTable("reference_lists", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
});

export const referenceListValues = pgTable("reference_list_values", {
  id: serial("id").primaryKey(),
  listKey: text("list_key")
    .notNull()
    .references(() => referenceLists.key),
  value: text("value").notNull(),
  retired: boolean("retired").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const customColumns = pgTable("custom_columns", {
  id: serial("id").primaryKey(),
  scope: columnScopeEnum("scope").notNull(),
  region: text("region"),
  preconDepartment: text("precon_department"),
  key: text("key").notNull(),
  label: text("label").notNull(),
  type: customFieldTypeEnum("type").notNull(),
  /** dropdown options for custom dropdown columns */
  options: jsonb("options").$type<string[]>(),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customColumnValues = pgTable(
  "custom_column_values",
  {
    id: serial("id").primaryKey(),
    columnId: integer("column_id")
      .notNull()
      .references(() => customColumns.id),
    roundId: integer("round_id")
      .notNull()
      .references(() => estimateRounds.id),
    value: text("value"),
  },
  (table) => [uniqueIndex("custom_column_values_column_round_unique").on(table.columnId, table.roundId)],
);

export const statusTransitions = pgTable("status_transitions", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id")
    .notNull()
    .references(() => estimateRounds.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  entity: text("entity").notNull(), // "round" | "schema" | "reference_list" | "job_match"
  entityId: integer("entity_id"),
  roundId: integer("round_id"),
  action: text("action").notNull(),
  field: text("field"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  body: text("body"),
  roundId: integer("round_id"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Import remediation queue (BRD Section 17). Legacy SmartSheet rows keep their
 * original text — nothing is rewritten — and every questionable value is
 * flagged here for a human to confirm or correct.
 */
export const dataQualityFlags = pgTable("data_quality_flags", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id")
    .notNull()
    .references(() => estimateRounds.id),
  /** Field key on estimateRounds, or a virtual key like `job` for link issues. */
  field: text("field").notNull(),
  /** "missing_required" | "unknown_list_value" | "unlinked_job" */
  kind: text("kind").notNull(),
  /** The offending value, preserved verbatim. */
  value: text("value"),
  resolvedAt: timestamp("resolved_at"),
  resolvedById: integer("resolved_by_id").references(() => users.id),
  resolutionNote: text("resolution_note"),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});

/** Small key/value store for admin-configurable behaviour (reminder cadence). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedById: integer("updated_by_id").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Outgoing email. Without provider credentials this is a visible stub outbox
 * so the cadence can be demonstrated and reviewed before SMTP/SSO exist.
 */
export const emailOutbox = pgTable("email_outbox", {
  id: serial("id").primaryKey(),
  toEmail: text("to_email").notNull(),
  toUserId: integer("to_user_id").references(() => users.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  /** "submitted" | "reminder" | "report_pdf" | "report_schedule" */
  kind: text("kind").notNull(),
  roundId: integer("round_id"),
  distributionListId: integer("distribution_list_id"),
  reportKey: text("report_key"),
  /** Base64 or storage key for PDF attachment (stub stores inline). */
  attachmentName: text("attachment_name"),
  attachmentStorageKey: text("attachment_storage_key"),
  /** "queued" | "claimed" | "previewed" | "sent" | "failed" */
  status: text("status").notNull().default("queued"),
  provider: text("provider").notNull().default("stub"),
  error: text("error"),
  attemptCount: integer("attempt_count").notNull().default(0),
  logicalDeliveryKey: text("logical_delivery_key"),
  providerMessageId: text("provider_message_id"),
  nextAttemptAt: timestamp("next_attempt_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
});

export const deletionBatches = pgTable("deletion_batches", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportArtifacts = pgTable("report_artifacts", {
  id: serial("id").primaryKey(),
  reportKey: text("report_key").notNull(),
  checksum: text("checksum").notNull(),
  byteSize: integer("byte_size").notNull(),
  contentType: text("content_type").notNull().default("application/pdf"),
  storageKey: text("storage_key").notNull(),
  region: text("region"),
  ownerId: integer("owner_id").references(() => users.id),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ExportTemplateConfig = {
  columns: string[];
  groupBy: string[];
  sortBy: { field: string; dir: "asc" | "desc" }[];
  header?: string;
  footer?: string;
};

export const reportTemplates = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  config: jsonb("config").$type<ExportTemplateConfig>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SavedReportConfig = {
  fields: string[]; // field keys, metric keys (metric:*), custom columns (custom:*)
  filters: { field: string; op: string; value: string }[];
  groupBy: string[];
  aggregations: { field: string; fn: "sum" | "avg" | "count" | "min" | "max" }[];
  sortBy: { field: string; dir: "asc" | "desc" }[];
};

export const savedReports = pgTable("saved_reports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  config: jsonb("config").$type<SavedReportConfig>().notNull(),
  sharedWithUserIds: jsonb("shared_with_user_ids").$type<number[]>().default([]),
  sharedWithRegions: jsonb("shared_with_regions").$type<string[]>().default([]),
  /** Stable key for presets (e.g. consolidated_regional_bid_schedule). */
  presetKey: text("preset_key"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  deletedById: integer("deleted_by_id").references(() => users.id),
});

/**
 * Sheets (Smartsheet workspace parity).
 *
 * A Region's Smartsheet workspace is a folder tree of sheets, and B&G builds
 * new ones constantly — a bid schedule per division, a self-perform capture, a
 * post-bid checklist, a roster. Two kinds cover all of it:
 *
 * - `view`  — a saved, named projection of the one pursuit dataset (columns,
 *   filters, sort, grouping). Smartsheet needed a physical copy per slice, so
 *   the same project existed in several sheets and drifted. Here a view reads
 *   live records, which is the whole point of the replacement.
 * - `grid`  — a standalone table with its own columns and rows, for the sheets
 *   that were never pursuit data (Precon Roster, Monthly Cost Tracking).
 */
export const sheetKindEnum = pgEnum("sheet_kind", ["view", "grid"]);

export const sheetColumnTypeEnum = pgEnum("sheet_column_type", [
  "text",
  "number",
  "dollars",
  "date",
  "dropdown",
  "checkbox",
  "contact",
]);

export type SheetFilter = { field: string; op: string; value: string };

export type SheetViewConfig = {
  /** Column keys: field keys, `metric:*`, or `custom:<id>`. */
  columns: string[];
  filters: SheetFilter[];
  sortBy: { field: string; dir: "asc" | "desc" }[];
  /** At most one grouping level; empty means a flat grid. */
  groupBy: string[];
  /** Persisted column widths, keyed by column key. */
  widths?: Record<string, number>;
};

export const sheets = pgTable("sheets", {
  id: serial("id").primaryKey(),
  kind: sheetKindEnum("kind").notNull().default("view"),
  name: text("name").notNull(),
  description: text("description"),
  /** null = the Corporate workspace, visible to every Region. */
  region: text("region"),
  /** Folder within the workspace, mirroring the Smartsheet folder tree. */
  folder: text("folder").notNull().default("General"),
  config: jsonb("config").$type<SheetViewConfig>(),
  ownerId: integer("owner_id").references(() => users.id),
  /** Seeded sheets that mirror a real Smartsheet sheet, for provenance. */
  sourceSheet: text("source_sheet"),
  sortOrder: integer("sort_order").notNull().default(0),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  deletedById: integer("deleted_by_id").references(() => users.id),
  deletionBatchId: integer("deletion_batch_id"),
});

/** Per-user favourites, surfaced under Sheets in the sidebar. */
export const sheetPins = pgTable(
  "sheet_pins",
  {
    id: serial("id").primaryKey(),
    sheetId: integer("sheet_id")
      .notNull()
      .references(() => sheets.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sheet_pins_sheet_user_unique").on(table.sheetId, table.userId)],
);

/** Columns of a `grid` sheet. View sheets draw columns from the field catalog. */
export const sheetColumns = pgTable("sheet_columns", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id")
    .notNull()
    .references(() => sheets.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  label: text("label").notNull(),
  type: sheetColumnTypeEnum("type").notNull().default("text"),
  options: jsonb("options").$type<string[]>(),
  width: integer("width").notNull().default(160),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Rows of a `grid` sheet, stored as a cell map keyed by column key. */
export const sheetRows = pgTable("sheet_rows", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id")
    .notNull()
    .references(() => sheets.id, { onDelete: "cascade" }),
  values: jsonb("values").$type<Record<string, string | null>>().notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedById: integer("updated_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  deletedById: integer("deleted_by_id").references(() => users.id),
  deletionBatchId: integer("deletion_batch_id"),
});

// ---------------------------------------------------------------------------
// Roadmap extensions (promotion, ACL, distribution, SF inbox, recovery, API,
// dashboards, DMR)
// ---------------------------------------------------------------------------

export const fieldPromotionStatusEnum = pgEnum("field_promotion_status", [
  "proposed",
  "rejected",
  "promoted",
]);

/** Region custom column → company standard promotion workflow. */
export const fieldPromotions = pgTable("field_promotions", {
  id: serial("id").primaryKey(),
  customColumnId: integer("custom_column_id")
    .notNull()
    .references(() => customColumns.id),
  status: fieldPromotionStatusEnum("status").notNull().default("proposed"),
  proposedById: integer("proposed_by_id")
    .notNull()
    .references(() => users.id),
  proposedAt: timestamp("proposed_at").notNull().defaultNow(),
  note: text("note"),
  conflictSummary: text("conflict_summary"),
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  promotedColumnId: integer("promoted_column_id").references(() => customColumns.id),
});

export const sheetAclRoleEnum = pgEnum("sheet_acl_role", [
  "viewer",
  "editor",
  "manager",
]);

export const sheetAcls = pgTable("sheet_acls", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id")
    .notNull()
    .references(() => sheets.id, { onDelete: "cascade" }),
  /** null userId + role means role-wide grant within regionAllowlist. */
  userId: integer("user_id").references(() => users.id),
  grantRole: roleEnum("grant_role"),
  acl: sheetAclRoleEnum("acl").notNull().default("viewer"),
  regionAllowlist: jsonb("region_allowlist").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Optional field write overrides. When no row exists, defaults from
 * `src/lib/policy.ts` apply (secure by role + lifecycle).
 */
export const fieldWritePolicies = pgTable("field_write_policies", {
  id: serial("id").primaryKey(),
  /** Field key or `custom:<id>`. */
  fieldKey: text("field_key").notNull(),
  role: roleEnum("role").notNull(),
  /** Round statuses where write is allowed; empty = never. */
  allowedStatuses: jsonb("allowed_statuses").$type<string[]>().notNull().default([]),
  regionScoped: boolean("region_scoped").notNull().default(true),
});

export const distributionLists = pgTable("distribution_lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region"),
  emails: jsonb("emails").$type<string[]>().notNull().default([]),
  cadence: text("cadence").notNull().default("manual"), // manual | weekly
  reportKey: text("report_key").notNull(),
  timezone: text("timezone").notNull().default("America/Chicago"),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  lastSentAt: timestamp("last_sent_at"),
  lastPeriodKey: text("last_period_key"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const distributionRuns = pgTable(
  "distribution_runs",
  {
    id: serial("id").primaryKey(),
    distributionListId: integer("distribution_list_id")
      .notNull()
      .references(() => distributionLists.id),
    periodKey: text("period_key").notNull(),
    status: text("status").notNull().default("queued"),
    outboxIds: jsonb("outbox_ids").$type<number[]>().default([]),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("distribution_runs_list_period_unique").on(
      table.distributionListId,
      table.periodKey,
    ),
  ],
);

export const salesforceSyncRuns = pgTable("salesforce_sync_runs", {
  id: serial("id").primaryKey(),
  cursor: text("cursor"),
  status: text("status").notNull().default("running"),
  opportunitiesSeen: integer("opportunities_seen").notNull().default(0),
  candidatesCreated: integer("candidates_created").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export const salesforceMatchStatusEnum = pgEnum("salesforce_match_status", [
  "pending",
  "approved",
  "rejected",
  "dismissed",
  "linked",
]);

export const salesforceMatchCandidates = pgTable("salesforce_match_candidates", {
  id: serial("id").primaryKey(),
  syncRunId: integer("sync_run_id").references(() => salesforceSyncRuns.id),
  jobId: integer("job_id").references(() => jobs.id),
  sfId: text("sf_id").notNull(),
  sourceVersion: text("source_version").notNull(),
  proposedJobNumber: text("proposed_job_number"),
  proposedJobName: text("proposed_job_name").notNull(),
  proposedRegion: text("proposed_region"),
  score: doublePrecision("score").notNull().default(0),
  signals: jsonb("signals").$type<Record<string, number | boolean | string>>().notNull().default({}),
  discrepancy: text("discrepancy"),
  status: salesforceMatchStatusEnum("status").notNull().default("pending"),
  decidedById: integer("decided_by_id").references(() => users.id),
  decidedAt: timestamp("decided_at"),
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const salesforceMatchSuppressions = pgTable("salesforce_match_suppressions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id"),
  sfId: text("sf_id").notNull(),
  sourceVersion: text("source_version").notNull(),
  reason: text("reason"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const entityVersions = pgTable(
  "entity_versions",
  {
    id: serial("id").primaryKey(),
    entityType: text("entity_type").notNull(), // round | sheet_row | job | sheet
    entityId: integer("entity_id").notNull(),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    changedById: integer("changed_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("entity_versions_entity_version_unique").on(
      table.entityType,
      table.entityId,
      table.version,
    ),
  ],
);

export const dataSnapshots = pgTable("data_snapshots", {
  id: serial("id").primaryKey(),
  periodKey: text("period_key").notNull(),
  storageKey: text("storage_key").notNull(),
  checksum: text("checksum").notNull(),
  byteSize: integer("byte_size").notNull().default(0),
  manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** sha256 hex of the secret; plaintext shown once at creation. */
  tokenHash: text("token_hash").notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  regionAllowlist: jsonb("region_allowlist").$type<string[]>().notNull().default([]),
  createdById: integer("created_by_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("api_tokens_token_hash_unique").on(table.tokenHash)]);

export const apiIdempotencyKeys = pgTable("api_idempotency_keys", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id")
    .notNull()
    .references(() => apiTokens.id),
  key: text("key").notNull(),
  operation: text("operation").notNull(),
  payloadHash: text("payload_hash").notNull(),
  responseStatus: integer("response_status").notNull(),
  responseBody: jsonb("response_body").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("api_idempotency_token_key_unique").on(table.tokenId, table.key)]);

export const apiDestructiveChallenges = pgTable("api_destructive_challenges", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id")
    .notNull()
    .references(() => apiTokens.id),
  actorId: integer("actor_id")
    .notNull()
    .references(() => users.id),
  challengeHash: text("challenge_hash").notNull(),
  operation: text("operation").notNull(),
  target: text("target").notNull(),
  payloadHash: text("payload_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("api_destructive_challenge_hash_unique").on(table.challengeHash)]);

export const dashboardScopeEnum = pgEnum("dashboard_scope", [
  "personal",
  "region",
  "corporate",
]);

export type DashboardWidgetConfig = {
  title: string;
  kind:
    | "kpi"
    | "table"
    | "bar"
    | "horizontal_bar"
    | "stacked_bar"
    | "line"
    | "area"
    | "pie"
    | "donut"
    | "projection"
    | "reconciliation";
  savedReportId?: number | null;
  metricKey?: string | null;
  groupBy?: string | null;
  filters?: { field: string; op: string; value: string }[];
  format?: string | null;
  layout?: { w: number; h: number; x: number; y: number };
};

export const dashboards = pgTable("dashboards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  scope: dashboardScopeEnum("scope").notNull().default("personal"),
  region: text("region"),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id")
    .notNull()
    .references(() => dashboards.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  config: jsonb("config").$type<DashboardWidgetConfig>().notNull(),
});

export const dmrImports = pgTable("dmr_imports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  source: text("source").notNull().default("upload"), // upload | databricks
  periodKey: text("period_key"),
  importedById: integer("imported_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dmrLines = pgTable("dmr_lines", {
  id: serial("id").primaryKey(),
  importId: integer("import_id")
    .notNull()
    .references(() => dmrImports.id, { onDelete: "cascade" }),
  jobNumber: text("job_number").notNull(),
  jobName: text("job_name"),
  region: text("region"),
  dmrValue: doublePrecision("dmr_value").notNull(),
});

export type Sheet = typeof sheets.$inferSelect;
export type SheetColumn = typeof sheetColumns.$inferSelect;
export type SheetRow = typeof sheetRows.$inferSelect;
export type SheetKind = Sheet["kind"];
export type SheetColumnType = SheetColumn["type"];

export type User = typeof users.$inferSelect;
export type DataQualityFlag = typeof dataQualityFlags.$inferSelect;
export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type EstimateRound = typeof estimateRounds.$inferSelect;
export type CustomColumn = typeof customColumns.$inferSelect;
export type RoundStatus = EstimateRound["status"];
export type Role = User["role"];
export type FieldPromotion = typeof fieldPromotions.$inferSelect;
export type DistributionList = typeof distributionLists.$inferSelect;
export type SalesforceMatchCandidate = typeof salesforceMatchCandidates.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type Dashboard = typeof dashboards.$inferSelect;
export type DashboardWidget = typeof dashboardWidgets.$inferSelect;
export type DmrImport = typeof dmrImports.$inferSelect;
export type DmrLine = typeof dmrLines.$inferSelect;

/** Better Auth OAuth tables (string IDs) — do not confuse with app `users`. */
export {
  user as authUser,
  session as authSession,
  account as authAccount,
  verification as authVerification,
} from "./auth-schema";
