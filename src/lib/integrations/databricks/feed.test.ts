import { describe, expect, it } from "vitest";
import { TIME_CARD_JOIN_KEYS } from "@/lib/time-card-join";
import { buildFeedRows } from "./feed";

describe("locked warehouse feed", () => {
  it("never includes an unlocked round", async () => {
    const rows = await buildFeedRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === "locked")).toBe(true);
    expect(rows.every((row) => Number(row.lock_revision) >= 1)).toBe(true);
  });

  it("exposes stable time-card join keys on every locked row", async () => {
    const rows = await buildFeedRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const key of TIME_CARD_JOIN_KEYS) {
        expect(row).toHaveProperty(key);
      }
      expect(Number(row.job_id)).toBeGreaterThan(0);
      expect(Number(row.round_id)).toBeGreaterThan(0);
    }
  });
});
