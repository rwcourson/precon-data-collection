DELETE FROM custom_column_values a USING custom_column_values b WHERE a.column_id = b.column_id AND a.round_id = b.round_id AND a.id > b.id;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS custom_column_values_column_round_unique ON custom_column_values (column_id, round_id);--> statement-breakpoint
DELETE FROM sheet_pins a USING sheet_pins b WHERE a.sheet_id = b.sheet_id AND a.user_id = b.user_id AND a.id > b.id;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS sheet_pins_sheet_user_unique ON sheet_pins (sheet_id, user_id);--> statement-breakpoint
DELETE FROM distribution_runs a USING distribution_runs b WHERE a.distribution_list_id = b.distribution_list_id AND a.period_key = b.period_key AND a.id > b.id;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS distribution_runs_list_period_unique ON distribution_runs (distribution_list_id, period_key);--> statement-breakpoint
DELETE FROM entity_versions a USING entity_versions b WHERE a.entity_type = b.entity_type AND a.entity_id = b.entity_id AND a.version = b.version AND a.id > b.id;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS entity_versions_entity_version_unique ON entity_versions (entity_type, entity_id, version);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS salesforce_match_candidates_job_sf_version_unique ON salesforce_match_candidates (job_id, sf_id, source_version) WHERE job_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS salesforce_match_suppressions_job_sf_version_unique ON salesforce_match_suppressions (job_id, sf_id, source_version) WHERE job_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS estimate_rounds_status_region_idx ON estimate_rounds (status, region) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS estimate_rounds_job_id_idx ON estimate_rounds (job_id) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS round_multi_values_round_field_idx ON round_multi_values (round_id, field);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS custom_column_values_round_idx ON custom_column_values (round_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sheet_rows_sheet_sort_idx ON sheet_rows (sheet_id, sort_order) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_log_round_created_idx ON audit_log (round_id, created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_log_entity_created_idx ON audit_log (entity, entity_id, created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_outbox_kind_created_idx ON email_outbox (kind, created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dashboards_owner_published_idx ON dashboards (owner_id, published);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS jobs_region_active_idx ON jobs (region);
