import { describe, expect, it } from "vitest";
import { TIME_CARD_JOIN_KEYS } from "./time-card-join";

describe("time-card join contract", () => {
  it("keeps job, round, lock revision, and date grain without a time-card screen", () => {
    expect([...TIME_CARD_JOIN_KEYS]).toEqual([
      "job_id",
      "job_number",
      "round_id",
      "lock_revision",
      "bid_due_date",
      "drawings_due_date",
      "project_start_month",
    ]);
  });
});
