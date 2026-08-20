import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { User } from "@/db/schema";
import { users } from "@/db/schema";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { createPrincipal } from "@/lib/authorization/principal";
import { EMPTY_HIERARCHY } from "@/lib/bid-schedule-filter";
import { filterNeedsStaffing } from "@/lib/staffing";
import { copilotQueryService } from "@/services/copilot-query-service";

function principalFor(user: User, workspaceRegion: string | null) {
  return createPrincipal({ user, authSource: "sso", workspaceRegion });
}

describe("copilot Principal-scoped tools", () => {
  const createdUserIds: number[] = [];

  afterAll(async () => {
    if (createdUserIds.length) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("needs-staffing matches the phase-7 preset rows", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const principal = principalFor(pcm, "Central");
    const listed = await listRoundsWithJobsForPrincipal(principal);
    const preset = filterNeedsStaffing(
      listed.map(({ round, job }) => ({
        status: round.status,
        teamAssignedAt: round.teamAssignedAt,
        preconDepartment: round.preconDepartment,
        roundId: round.id,
        homeRegion: job.region,
      })),
      EMPTY_HIERARCHY
    );
    const tool = await copilotQueryService.queryNeedsStaffing(principal);
    expect(tool.map((row) => row.roundId).sort()).toEqual(
      preset.map((row) => row.roundId).sort()
    );
  });

  it("person history answers from estimateLead + staffing marks for 2026", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const [lead] = await db
      .select()
      .from(users)
      .where(eq(users.role, "estimate_lead"))
      .limit(1);
    const principal = principalFor(pcm, "Central");
    const listed = await listRoundsWithJobsForPrincipal(principal);
    const expected = listed
      .filter(
        ({ round }) =>
          round.bidYear === 2026 &&
          (round.estimateLeadId === lead.id ||
            round.teamAssignedById === lead.id)
      )
      .map(({ round }) => round.id)
      .sort();
    const result = await copilotQueryService.personHistory(principal, {
      name: lead.name,
      year: 2026,
    });
    expect(result.person?.id).toBe(lead.id);
    expect(result.efforts.map((row) => row.roundId).sort()).toEqual(expected);
    expect(result.efforts.length).toBeGreaterThan(0);
  });

  it("notes search returns round_notes with round citations", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const principal = principalFor(pcm, "Central");
    const hits = await copilotQueryService.searchNotes(
      principal,
      "ROM package"
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.excerpt).toMatch(/ROM package/i);
    expect(hits[0]?.citation).toMatch(/round \d+/);
    expect(hits[0]?.roundId).toBeGreaterThan(0);
    expect(hits[0]?.jobName.length).toBeGreaterThan(0);
  });

  it("region-scoped principal never receives another region's rows", async () => {
    const [georgia] = await db
      .insert(users)
      .values({
        name: "Georgia Copilot PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Georgia",
        preconDepartment: "Georgia – Commercial",
        email: `ga-copilot-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(georgia.id);
    const ga = principalFor(georgia, "Georgia");
    const efforts = await copilotQueryService.queryEfforts(ga);
    expect(efforts.every((row) => row.homeRegion !== "Central")).toBe(true);
    const staffing = await copilotQueryService.queryNeedsStaffing(ga);
    expect(staffing.every((row) => row.homeRegion !== "Central")).toBe(true);
    const notes = await copilotQueryService.searchNotes(ga, "ROM package");
    expect(notes).toEqual([]);
    const history = await copilotQueryService.personHistory(ga, {
      name: "Marcus Webb",
      year: 2026,
    });
    expect(history.efforts.every((row) => row.homeRegion !== "Central")).toBe(
      true
    );
  });

  it("token and MCP principals only see locked efforts", async () => {
    const [rpd] = await db
      .select()
      .from(users)
      .where(eq(users.role, "rpd"))
      .limit(1);
    const tokenPrincipal = createPrincipal({
      user: rpd,
      authSource: "api_token",
      workspaceRegion: rpd.region,
      token: {
        id: 1,
        name: "copilot-lock",
        tokenHash: "hash",
        tokenPrefix: "copi",
        scopes: ["read:pursuits"],
        regionAllowlist: rpd.region ? [rpd.region] : [],
        createdById: rpd.id,
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      },
    });
    const efforts = await copilotQueryService.queryEfforts(tokenPrincipal);
    expect(efforts.length).toBeGreaterThan(0);
    expect(efforts.every((row) => row.status === "locked")).toBe(true);
  });
});
