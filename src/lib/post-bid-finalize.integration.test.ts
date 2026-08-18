import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  customColumns,
  customColumnValues,
  estimateRounds,
  jobs,
  users,
} from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import { regionCustomTabForRound } from "@/lib/region-custom-columns";
import { evaluateLockGate, missingRequiredFields } from "@/lib/validation";
import { finalizeRound } from "@/services/finalize-round";
import { pursuitService } from "@/services/pursuit-service";

describe("post-bid region tab and finalize seam", () => {
  const createdValueIds: number[] = [];

  afterAll(async () => {
    if (createdValueIds.length > 0) {
      await db
        .delete(customColumnValues)
        .where(inArray(customColumnValues.id, createdValueIds));
    }
  });

  it("Central Heavy Civil rounds get the Central tab; Georgia rounds do not", async () => {
    const cols = await db.select().from(customColumns);
    const [central] = await db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.preconDepartment, "Central Heavy Civil"))
      .limit(1);
    const [georgia] = await db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.region, "Georgia"))
      .limit(1);
    const centralTab = regionCustomTabForRound(cols, central);
    expect(centralTab?.title).toBe("Central — Heavy Civil");
    expect(centralTab?.columns.some((c) => c.key === "spoilDisposalSite")).toBe(
      true
    );

    const georgiaTab = regionCustomTabForRound(cols, georgia);
    expect(georgiaTab?.title ?? "").not.toMatch(/Central/);
    expect(georgiaTab?.columns.some((c) => c.region === "Central")).toBeFalsy();
  });

  it("saves and reloads a region custom column via custom_column_values", async () => {
    const [rpd] = await db
      .select()
      .from(users)
      .where(eq(users.role, "rpd"))
      .limit(1);
    const [col] = await db
      .select()
      .from(customColumns)
      .where(eq(customColumns.key, "spoilDisposalSite"));
    const [job] = await db
      .select({
        id: jobs.id,
        region: jobs.region,
        preconDepartment: jobs.preconDepartment,
      })
      .from(jobs)
      .where(eq(jobs.preconDepartment, "Central Heavy Civil"))
      .limit(1);
    const [round] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 99,
        status: "post_bid",
        region: job.region,
        preconDepartment: job.preconDepartment,
        estimatePhase: "GMP",
        bidYear: 2026,
        createdById: rpd.id,
      })
      .returning();
    const actor = createPrincipal({
      user: rpd,
      authSource: "sso",
      workspaceRegion: "Central",
    });
    await pursuitService.savePostBidData(actor, {
      roundId: round.id,
      values: {},
      multiValues: {},
      customValues: { [col.id]: "Landfill A (demo)" },
    });
    const [row] = await db
      .select()
      .from(customColumnValues)
      .where(
        and(
          eq(customColumnValues.columnId, col.id),
          eq(customColumnValues.roundId, round.id)
        )
      );
    expect(row?.value).toBe("Landfill A (demo)");
    if (row) {
      createdValueIds.push(row.id);
      await db
        .delete(customColumnValues)
        .where(eq(customColumnValues.id, row.id));
    }
    await db.delete(estimateRounds).where(eq(estimateRounds.id, round.id));
  });

  it("lock gate ignores region custom columns", async () => {
    const [row] = await db
      .select({ round: estimateRounds, job: jobs })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(eq(estimateRounds.status, "locked"))
      .limit(1);
    const missing = missingRequiredFields(
      row.round,
      {},
      {
        jobNumber: row.job.jobNumber,
        jobName: row.job.jobName,
        estimateLeadName: "Lead",
      }
    );
    expect(missing.join(" ")).not.toMatch(
      /demo|River Mile|Spoil Disposal|Clean Room/i
    );
    const gate = evaluateLockGate(
      row.round,
      {},
      {
        jobNumber: row.job.jobNumber,
        jobName: row.job.jobName,
        estimateLeadName: "Lead",
      }
    );
    if (!gate.ok) {
      expect(gate.missingFields.join(" ")).not.toMatch(
        /demo|River Mile|Spoil Disposal|Clean Room/i
      );
    }
  });

  it("finalizeRound default is lock-passthrough and still enforces the required-field gate", async () => {
    const [rpd] = await db
      .select()
      .from(users)
      .where(eq(users.role, "rpd"))
      .limit(1);
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `FIN-${Date.now()}`,
        jobName: "Finalize seam subject",
        region: "Central",
        preconDepartment: "Central Building Group",
        createdById: rpd.id,
      })
      .returning();
    const [round] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 1,
        status: "post_bid",
        region: "Central",
        preconDepartment: "Central Building Group",
        estimatePhase: "GMP",
        bidYear: 2026,
        createdById: rpd.id,
      })
      .returning();
    const principal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: "Central",
    });
    const result = await finalizeRound(round.id, principal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingFields).toContain("Fee – Expected $");
    }
    await db.delete(estimateRounds).where(eq(estimateRounds.id, round.id));
    await db.delete(jobs).where(eq(jobs.id, job.id));
  });
});
