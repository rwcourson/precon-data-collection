import { describe, expect, it } from "vitest";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { estimateRounds, jobs, users, type User } from "@/db/schema";
import {
  countPreBidStatusesForPrincipal,
  listRoundsWithJobsForPrincipal,
  loadJobForPrincipal,
  loadRoundForPrincipal,
} from "./loaders";
import { createPrincipal } from "./principal";
import type { Principal } from "./types";

/**
 * Pins CURRENT job/round visibility (home-region column + workspace cookie)
 * so the phase-2 schema rewrite cannot silently change who sees what for
 * jobs that only have a home region. These tests must pass before AND after
 * `job_region_visibility` backfill.
 */
function principalFor(user: User, workspaceRegion: string | null): Principal {
  return createPrincipal({
    user,
    authSource: "sso",
    workspaceRegion,
  });
}

async function seeded(): Promise<{
  pcm: User;
  leadership: User;
  corporate: User;
  estimateLead: User;
  adminJsa: User;
  rpd: User;
  centralJob: typeof jobs.$inferSelect;
  floridaJob: typeof jobs.$inferSelect;
  floridaRound: typeof estimateRounds.$inferSelect;
}> {
  const allUsers = await db.select().from(users);
  const pcm = allUsers.find((row) => row.role === "pcm")!;
  const leadership = allUsers.find((row) => row.role === "leadership")!;
  const corporate = allUsers.find((row) => row.role === "corporate_admin")!;
  const estimateLead = allUsers.find((row) => row.role === "estimate_lead")!;
  const adminJsa = allUsers.find((row) => row.role === "admin_jsa")!;
  const rpd = allUsers.find((row) => row.role === "rpd")!;
  const [centralJob] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.region, "Central"), isNull(jobs.deletedAt)))
    .limit(1);
  const [floridaJob] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.region, "Florida"), isNull(jobs.deletedAt)))
    .limit(1);
  const [floridaRound] = await db
    .select()
    .from(estimateRounds)
    .where(and(eq(estimateRounds.region, "Florida"), isNull(estimateRounds.deletedAt)))
    .limit(1);
  expect(pcm).toBeDefined();
  expect(leadership).toBeDefined();
  expect(corporate).toBeDefined();
  expect(centralJob).toBeDefined();
  expect(floridaJob).toBeDefined();
  expect(floridaRound).toBeDefined();
  return { pcm, leadership, corporate, estimateLead, adminJsa, rpd, centralJob, floridaJob, floridaRound };
}

describe("characterization: current job visibility per role × region", () => {
  it("pcm in Central workspace sees Central jobs and not Florida jobs", async () => {
    const { pcm, centralJob, floridaJob, floridaRound } = await seeded();
    const actor = principalFor(pcm, "Central");
    expect((await loadJobForPrincipal(actor, centralJob.id))?.value.id).toBe(centralJob.id);
    expect(await loadJobForPrincipal(actor, floridaJob.id)).toBeNull();
    expect(await loadRoundForPrincipal(actor, floridaRound.id)).toBeNull();

    const listed = await listRoundsWithJobsForPrincipal(actor);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((row) => row.job.region === "Central")).toBe(true);
    expect(listed.some((row) => row.job.region === "Florida")).toBe(false);
  });

  it("estimate_lead, admin_jsa, and rpd in Central workspace match pcm (own region only)", async () => {
    const { estimateLead, adminJsa, rpd, centralJob, floridaJob } = await seeded();
    for (const user of [estimateLead, adminJsa, rpd]) {
      const actor = principalFor(user, "Central");
      expect((await loadJobForPrincipal(actor, centralJob.id))?.value.id).toBe(centralJob.id);
      expect(await loadJobForPrincipal(actor, floridaJob.id)).toBeNull();
      const listed = await listRoundsWithJobsForPrincipal(actor);
      expect(listed.every((row) => row.job.region === "Central")).toBe(true);
    }
  });

  it("corporate_admin in corporate workspace sees every region", async () => {
    const { corporate, centralJob, floridaJob } = await seeded();
    const actor = principalFor(corporate, null);
    expect((await loadJobForPrincipal(actor, centralJob.id))?.value.id).toBe(centralJob.id);
    expect((await loadJobForPrincipal(actor, floridaJob.id))?.value.id).toBe(floridaJob.id);

    const listed = await listRoundsWithJobsForPrincipal(actor);
    const regions = new Set(listed.map((row) => row.job.region));
    expect(regions.has("Central")).toBe(true);
    expect(regions.has("Florida")).toBe(true);
  });

  it("leadership in corporate workspace sees Florida; leadership pinned to Central does not", async () => {
    const { leadership, floridaJob, centralJob } = await seeded();
    const corporateWs = principalFor(leadership, null);
    const centralWs = principalFor(leadership, "Central");

    expect((await loadJobForPrincipal(corporateWs, floridaJob.id))?.value.id).toBe(floridaJob.id);
    expect(await loadJobForPrincipal(centralWs, floridaJob.id)).toBeNull();
    expect((await loadJobForPrincipal(centralWs, centralJob.id))?.value.id).toBe(centralJob.id);

    const corpList = await listRoundsWithJobsForPrincipal(corporateWs);
    const pinnedList = await listRoundsWithJobsForPrincipal(centralWs);
    expect(corpList.some((row) => row.job.region === "Florida")).toBe(true);
    expect(pinnedList.some((row) => row.job.region === "Florida")).toBe(false);
    expect(pinnedList.every((row) => row.job.region === "Central")).toBe(true);
  });

  it("pre-bid bucket counts for Central workspace are a subset of corporate_admin totals", async () => {
    const { pcm, corporate } = await seeded();
    const central = await countPreBidStatusesForPrincipal(principalFor(pcm, "Central"));
    const all = await countPreBidStatusesForPrincipal(principalFor(corporate, null));
    expect(central.active + central.upcoming + central.outstanding).toBeGreaterThan(0);
    expect(all.active).toBeGreaterThanOrEqual(central.active);
    expect(all.upcoming).toBeGreaterThanOrEqual(central.upcoming);
    expect(all.outstanding).toBeGreaterThanOrEqual(central.outstanding);
    expect(all.active + all.upcoming + all.outstanding).toBeGreaterThan(
      central.active + central.upcoming + central.outstanding,
    );
  });

  it("home-region column still distinguishes Central from other seeded jobs", async () => {
    const [other] = await db
      .select()
      .from(jobs)
      .where(and(ne(jobs.region, "Central"), isNull(jobs.deletedAt)))
      .limit(1);
    expect(other).toBeDefined();
    expect(other.region).not.toBe("Central");
  });
});
