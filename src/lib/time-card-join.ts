/**
 * Stable keys for a future time-card join. Do not add a time-card screen.
 */
export const TIME_CARD_JOIN_KEYS = [
  "job_id",
  "job_number",
  "round_id",
  "lock_revision",
  "bid_due_date",
  "drawings_due_date",
  "project_start_month",
] as const;

export type TimeCardJoinKey = (typeof TIME_CARD_JOIN_KEYS)[number];
