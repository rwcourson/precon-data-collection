CREATE TYPE "public"."column_scope" AS ENUM('company', 'region');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'dollars', 'date', 'dropdown');--> statement-breakpoint
CREATE TYPE "public"."dashboard_scope" AS ENUM('personal', 'region', 'corporate');--> statement-breakpoint
CREATE TYPE "public"."field_promotion_status" AS ENUM('proposed', 'rejected', 'promoted');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('pending', 'successful', 'unsuccessful');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('pcm', 'estimate_lead', 'admin_jsa', 'rpd', 'leadership', 'corporate_admin');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('active', 'upcoming', 'outstanding', 'submitted', 'post_bid', 'locked');--> statement-breakpoint
CREATE TYPE "public"."salesforce_match_status" AS ENUM('pending', 'approved', 'rejected', 'dismissed', 'linked');--> statement-breakpoint
CREATE TYPE "public"."sheet_acl_role" AS ENUM('viewer', 'editor', 'manager');--> statement-breakpoint
CREATE TYPE "public"."sheet_column_type" AS ENUM('text', 'number', 'dollars', 'date', 'dropdown', 'checkbox', 'contact');--> statement-breakpoint
CREATE TYPE "public"."sheet_kind" AS ENUM('view', 'grid');--> statement-breakpoint
CREATE TABLE "api_destructive_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_id" integer NOT NULL,
	"challenge" text NOT NULL,
	"operation" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_idempotency_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_id" integer NOT NULL,
	"key" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"region_allowlist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_id" integer NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_id" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"round_id" integer,
	"action" text NOT NULL,
	"field" text,
	"old_value" text,
	"new_value" text,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_column_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"column_id" integer NOT NULL,
	"round_id" integer NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "custom_columns" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" "column_scope" NOT NULL,
	"region" text,
	"precon_department" text,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" "custom_field_type" NOT NULL,
	"options" jsonb,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_widgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"dashboard_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scope" "dashboard_scope" DEFAULT 'personal' NOT NULL,
	"region" text,
	"owner_id" integer NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "data_quality_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"round_id" integer NOT NULL,
	"field" text NOT NULL,
	"kind" text NOT NULL,
	"value" text,
	"resolved_at" timestamp,
	"resolved_by_id" integer,
	"resolution_note" text,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_key" text NOT NULL,
	"storage_key" text NOT NULL,
	"checksum" text NOT NULL,
	"byte_size" integer DEFAULT 0 NOT NULL,
	"manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distribution_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cadence" text DEFAULT 'manual' NOT NULL,
	"report_key" text NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"owner_id" integer NOT NULL,
	"last_sent_at" timestamp,
	"last_period_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "distribution_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"distribution_list_id" integer NOT NULL,
	"period_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"outbox_ids" jsonb DEFAULT '[]'::jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dmr_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text DEFAULT 'upload' NOT NULL,
	"period_key" text,
	"imported_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dmr_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_id" integer NOT NULL,
	"job_number" text NOT NULL,
	"job_name" text,
	"region" text,
	"dmr_value" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"to_email" text NOT NULL,
	"to_user_id" integer,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"kind" text NOT NULL,
	"round_id" integer,
	"distribution_list_id" integer,
	"report_key" text,
	"attachment_name" text,
	"attachment_storage_key" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider" text DEFAULT 'stub' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "entity_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimate_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"round_number" integer NOT NULL,
	"status" "round_status" DEFAULT 'upcoming' NOT NULL,
	"outcome" "outcome" DEFAULT 'pending' NOT NULL,
	"region" text NOT NULL,
	"precon_department" text NOT NULL,
	"estimate_phase" text NOT NULL,
	"bid_year" integer NOT NULL,
	"bid_due_date" date,
	"project_start_date" date,
	"city" text,
	"state" text,
	"estimate_lead_id" integer,
	"mlt" text,
	"market_sector" text,
	"contract_type" text,
	"procurement" text,
	"design_contract" text,
	"status_at_pricing" text,
	"internal_joint_venture" text,
	"awardability" text,
	"business_strategy_values" text,
	"estimate_value" double precision,
	"fee_back_page" double precision,
	"fee_expected" double precision,
	"contingency_total" double precision,
	"craft_labor_base" double precision,
	"craft_labor_burden" double precision,
	"craft_labor_man_hours" double precision,
	"gc_bg_sort" double precision,
	"gr_bg_sort" double precision,
	"gc_proposed_owner_sov" double precision,
	"gr_proposed_owner_sov" double precision,
	"pm_months" double precision,
	"field_supervision_months" double precision,
	"precon_cost" double precision,
	"design_cost" double precision,
	"self_perform_priced" double precision,
	"self_perform_proposed" double precision,
	"project_schedule_duration" double precision,
	"project_planning_precon_engagement" text,
	"gsf" double precision,
	"hotel_keys_units" double precision,
	"materials" double precision,
	"supplies" double precision,
	"equipment" double precision,
	"equipment_operation" double precision,
	"subcontracted" double precision,
	"market_or_strategic_rates" text,
	"sub_quotes_received" double precision,
	"mwdbe_sub_quotes_received" double precision,
	"mwdbe_subs_plugged" double precision,
	"cost_of_work_basis" double precision,
	"afm_months" double precision,
	"peak_manpower_headcount" double precision,
	"submitted_at" timestamp,
	"locked_at" timestamp,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "field_promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"custom_column_id" integer NOT NULL,
	"status" "field_promotion_status" DEFAULT 'proposed' NOT NULL,
	"proposed_by_id" integer NOT NULL,
	"proposed_at" timestamp DEFAULT now() NOT NULL,
	"note" text,
	"conflict_summary" text,
	"reviewed_by_id" integer,
	"reviewed_at" timestamp,
	"review_note" text,
	"promoted_column_id" integer
);
--> statement-breakpoint
CREATE TABLE "field_write_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_key" text NOT NULL,
	"role" "role" NOT NULL,
	"allowed_statuses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"region_scoped" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_number" text NOT NULL,
	"job_name" text NOT NULL,
	"region" text NOT NULL,
	"precon_department" text NOT NULL,
	"salesforce_id" text,
	"is_linked" boolean DEFAULT false NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"round_id" integer,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_list_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_key" text NOT NULL,
	"value" text NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_lists" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" integer NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_multi_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"round_id" integer NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salesforce_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"sf_id" text NOT NULL,
	"job_number" text NOT NULL,
	"job_name" text NOT NULL,
	"region" text NOT NULL,
	"market_sector" text,
	"city" text,
	"state" text,
	"created_date" date
);
--> statement-breakpoint
CREATE TABLE "salesforce_match_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_run_id" integer,
	"job_id" integer,
	"sf_id" text NOT NULL,
	"source_version" text NOT NULL,
	"proposed_job_number" text,
	"proposed_job_name" text NOT NULL,
	"proposed_region" text,
	"score" double precision DEFAULT 0 NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"discrepancy" text,
	"status" "salesforce_match_status" DEFAULT 'pending' NOT NULL,
	"decided_by_id" integer,
	"decided_at" timestamp,
	"decision_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salesforce_match_suppressions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"sf_id" text NOT NULL,
	"source_version" text NOT NULL,
	"reason" text,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salesforce_sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"cursor" text,
	"status" text DEFAULT 'running' NOT NULL,
	"opportunities_seen" integer DEFAULT 0 NOT NULL,
	"candidates_created" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" integer NOT NULL,
	"config" jsonb NOT NULL,
	"shared_with_user_ids" jsonb DEFAULT '[]'::jsonb,
	"shared_with_regions" jsonb DEFAULT '[]'::jsonb,
	"preset_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "sheet_acls" (
	"id" serial PRIMARY KEY NOT NULL,
	"sheet_id" integer NOT NULL,
	"user_id" integer,
	"grant_role" "role",
	"acl" "sheet_acl_role" DEFAULT 'viewer' NOT NULL,
	"region_allowlist" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheet_columns" (
	"id" serial PRIMARY KEY NOT NULL,
	"sheet_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" "sheet_column_type" DEFAULT 'text' NOT NULL,
	"options" jsonb,
	"width" integer DEFAULT 160 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheet_pins" (
	"id" serial PRIMARY KEY NOT NULL,
	"sheet_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheet_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"sheet_id" integer NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "sheet_kind" DEFAULT 'view' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"region" text,
	"folder" text DEFAULT 'General' NOT NULL,
	"config" jsonb,
	"owner_id" integer,
	"source_sheet" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "status_transitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"round_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"role" "role" NOT NULL,
	"region" text,
	"precon_department" text,
	"email" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" ADD CONSTRAINT "api_destructive_challenges_token_id_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_idempotency_keys" ADD CONSTRAINT "api_idempotency_keys_token_id_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_column_values" ADD CONSTRAINT "custom_column_values_column_id_custom_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."custom_columns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_column_values" ADD CONSTRAINT "custom_column_values_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_columns" ADD CONSTRAINT "custom_columns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_flags" ADD CONSTRAINT "data_quality_flags_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_flags" ADD CONSTRAINT "data_quality_flags_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_lists" ADD CONSTRAINT "distribution_lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_runs" ADD CONSTRAINT "distribution_runs_distribution_list_id_distribution_lists_id_fk" FOREIGN KEY ("distribution_list_id") REFERENCES "public"."distribution_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dmr_imports" ADD CONSTRAINT "dmr_imports_imported_by_id_users_id_fk" FOREIGN KEY ("imported_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dmr_lines" ADD CONSTRAINT "dmr_lines_import_id_dmr_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."dmr_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_versions" ADD CONSTRAINT "entity_versions_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD CONSTRAINT "estimate_rounds_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD CONSTRAINT "estimate_rounds_estimate_lead_id_users_id_fk" FOREIGN KEY ("estimate_lead_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD CONSTRAINT "estimate_rounds_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD CONSTRAINT "estimate_rounds_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_promotions" ADD CONSTRAINT "field_promotions_custom_column_id_custom_columns_id_fk" FOREIGN KEY ("custom_column_id") REFERENCES "public"."custom_columns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_promotions" ADD CONSTRAINT "field_promotions_proposed_by_id_users_id_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_promotions" ADD CONSTRAINT "field_promotions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_promotions" ADD CONSTRAINT "field_promotions_promoted_column_id_custom_columns_id_fk" FOREIGN KEY ("promoted_column_id") REFERENCES "public"."custom_columns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_list_values" ADD CONSTRAINT "reference_list_values_list_key_reference_lists_key_fk" FOREIGN KEY ("list_key") REFERENCES "public"."reference_lists"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_multi_values" ADD CONSTRAINT "round_multi_values_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesforce_match_candidates" ADD CONSTRAINT "salesforce_match_candidates_sync_run_id_salesforce_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."salesforce_sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesforce_match_candidates" ADD CONSTRAINT "salesforce_match_candidates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesforce_match_candidates" ADD CONSTRAINT "salesforce_match_candidates_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesforce_match_suppressions" ADD CONSTRAINT "salesforce_match_suppressions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_acls" ADD CONSTRAINT "sheet_acls_sheet_id_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_acls" ADD CONSTRAINT "sheet_acls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_columns" ADD CONSTRAINT "sheet_columns_sheet_id_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_pins" ADD CONSTRAINT "sheet_pins_sheet_id_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_pins" ADD CONSTRAINT "sheet_pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_rows" ADD CONSTRAINT "sheet_rows_sheet_id_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_rows" ADD CONSTRAINT "sheet_rows_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_rows" ADD CONSTRAINT "sheet_rows_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;