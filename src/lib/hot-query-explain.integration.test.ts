import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";

async function explain(query: string): Promise<string> {
  await db.execute(sql.raw("SET enable_seqscan = off"));
  const result = await db.execute(sql.raw(`EXPLAIN ${query}`));
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? [result]);
  return rows
    .map((row) =>
      row && typeof row === "object"
        ? Object.values(row).join(" ")
        : String(row)
    )
    .join("\n");
}

describe("hot query plans", () => {
  it("uses indexes for visibility, latest-note, and staffing count", async () => {
    const visibility = await explain(`
      SELECT er.id
      FROM estimate_rounds er
      INNER JOIN jobs j ON j.id = er.job_id
      WHERE er.deleted_at IS NULL
        AND j.deleted_at IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM job_region_visibility v
            WHERE v.job_id = j.id AND v.region = 'Central'
          )
          OR EXISTS (
            SELECT 1 FROM job_user_visibility u
            WHERE u.job_id = j.id AND u.user_id = 1
          )
        )
    `);
    const latestNote = await explain(`
      SELECT DISTINCT ON (round_id) round_id, created_at
      FROM round_notes
      WHERE deleted_at IS NULL
      ORDER BY round_id, created_at DESC
    `);
    const staffing = await explain(`
      SELECT count(*)
      FROM estimate_rounds er
      INNER JOIN jobs j ON j.id = er.job_id
      WHERE er.deleted_at IS NULL
        AND j.deleted_at IS NULL
        AND er.status = 'upcoming'
        AND er.team_assigned_at IS NULL
        AND EXISTS (
          SELECT 1 FROM job_region_visibility v
          WHERE v.job_id = j.id AND v.region = 'Central'
        )
    `);

    expect(visibility).toMatch(/Index Scan|Bitmap Index|Index Only Scan/i);
    expect(latestNote).toMatch(/Index Scan|Bitmap Index|Index Only Scan/i);
    expect(staffing).toMatch(/Index Scan|Bitmap Index|Index Only Scan/i);
  });
});
