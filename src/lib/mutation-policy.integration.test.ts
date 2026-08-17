import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "@/db";
import {
  apiTokens,
  estimateRounds,
  jobs,
  sheetAcls,
  sheets,
  statusTransitions,
  users,
} from "@/db/schema";

async function deleteRoundTree(roundId: number, jobId: number) {
  await db.delete(statusTransitions).where(eq(statusTransitions.roundId, roundId));
  await db.delete(estimateRounds).where(eq(estimateRounds.id, roundId));
  await db.delete(jobs).where(eq(jobs.id, jobId));
}
import { DomainError } from "@/domain/errors";
import { createPrincipal } from "@/lib/authorization/principal";
import { issueDemoSession } from "@/lib/mobile-auth";
import { POST as transitionPost } from "@/app/api/v1/mobile/rounds/[id]/transition/route";
import { POST as pursuitsPost } from "@/app/api/v1/mobile/pursuits/route";
import { pursuitService, requireCreatedPursuit } from "@/services/pursuit-service";
import {
  assertPrincipalCanDistribute,
  assertPrincipalCanCreatePursuit,
} from "@/services/mutation-policy";

let pcm: typeof users.$inferSelect;
let leadership: typeof users.$inferSelect;
let corporateAdmin: typeof users.$inferSelect;
let rpd: typeof users.$inferSelect;
const issued: string[] = [];

async function session(user: typeof users.$inferSelect) {
  const issuedToken = await issueDemoSession(user.id);
  if ("error" in issuedToken) throw new Error(issuedToken.error);
  issued.push(issuedToken.token);
  return issuedToken.token;
}

function request(url: string, token: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-workspace-region": pcm.region ?? "Central",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  await ensureDbReady();
  [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
  [leadership] = await db.select().from(users).where(eq(users.role, "leadership")).limit(1);
  [corporateAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "corporate_admin"))
    .limit(1);
  [rpd] = await db.select().from(users).where(eq(users.role, "rpd")).limit(1);
  if (!pcm?.region || !leadership || !corporateAdmin || !rpd) {
    throw new Error("Required seeded roles are missing");
  }
});

afterAll(async () => {
  const { hashToken } = await import("@/lib/api-tokens");
  for (const plaintext of issued) {
    await db.delete(apiTokens).where(eq(apiTokens.tokenHash, hashToken(plaintext)));
  }
});

describe("mutation policy negative matrix", () => {
  it("denies read-only leadership and corporate-admin field edits", async () => {
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `P6-RO-${Date.now()}`,
        jobName: "Phase 6 read-only",
        region: pcm.region!,
        preconDepartment: "Test",
        createdById: pcm.id,
      })
      .returning();
    const [round] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 1,
        status: "post_bid",
        region: pcm.region!,
        preconDepartment: "Test",
        estimatePhase: "ROM",
        bidYear: 2026,
        createdById: pcm.id,
      })
      .returning();

    try {
      const leadershipPrincipal = createPrincipal({
        user: leadership,
        authSource: "demo_session",
        workspaceRegion: pcm.region,
      });
      await expect(
        pursuitService.savePostBidData(leadershipPrincipal, {
          roundId: round.id,
          values: { city: "Forbiddenville" },
          multiValues: {},
          customValues: {},
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" satisfies DomainError["code"] });

      const pcmPrincipal = createPrincipal({
        user: pcm,
        authSource: "demo_session",
        workspaceRegion: pcm.region,
      });
      // PCM cannot edit post-bid-only fields while unlocked estimate_lead/admin/rpd can.
      await expect(
        pursuitService.savePostBidData(pcmPrincipal, {
          roundId: round.id,
          values: { city: "AllowedCity" },
          multiValues: {},
          customValues: {},
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await deleteRoundTree(round.id, job.id);
    }
  });

  it("enforces Region and lifecycle on pursuit create, transition, and outcome", async () => {
    const otherRegion = pcm.region === "Florida" ? "Central" : "Florida";
    const pcmPrincipal = createPrincipal({
      user: pcm,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    const leadershipPrincipal = createPrincipal({
      user: leadership,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });

    expect(() => assertPrincipalCanCreatePursuit(leadershipPrincipal, pcm.region!)).toThrow(
      DomainError,
    );
    expect(() => assertPrincipalCanCreatePursuit(pcmPrincipal, otherRegion)).toThrow(DomainError);

    const created = requireCreatedPursuit(
      await pursuitService.createPursuit(pcmPrincipal, {
      mode: "manual",
      jobName: `Phase 6 create ${Date.now()}`,
      region: pcm.region!,
      preconDepartment: "Test",
      estimatePhase: "ROM",
      bidYear: 2026,
      initialStatus: "active",
      confirmDuplicate: true,
    }),
    );

    try {
      await expect(
        pursuitService.transitionStatus(leadershipPrincipal, created.roundId, "submitted"),
      ).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/) });

      await pursuitService.transitionStatus(pcmPrincipal, created.roundId, "upcoming");
      const [after] = await db
        .select()
        .from(estimateRounds)
        .where(eq(estimateRounds.id, created.roundId));
      expect(after?.status).toBe("upcoming");

      await expect(
        pursuitService.setOutcome(leadershipPrincipal, created.roundId, "successful"),
      ).rejects.toBeInstanceOf(DomainError);
    } finally {
      await deleteRoundTree(created.roundId, created.jobId);
    }
  });

  it("requires sheet editor/manager capability for mutations", async () => {
    const [sheet] = await db
      .insert(sheets)
      .values({
        kind: "grid",
        name: `Phase 6 sheet ${Date.now()}`,
        region: null,
        ownerId: corporateAdmin.id,
      })
      .returning();
    const [acl] = await db
      .insert(sheetAcls)
      .values({ sheetId: sheet.id, userId: pcm.id, acl: "viewer" })
      .returning();

    try {
      const principal = createPrincipal({
        user: pcm,
        authSource: "demo_session",
        workspaceRegion: pcm.region,
      });
      const { loadSheetForPrincipal } = await import("@/lib/authorization/loaders");
      expect(await loadSheetForPrincipal(principal, sheet.id, "edit")).toBeNull();
      expect(await loadSheetForPrincipal(principal, sheet.id, "manage")).toBeNull();
      expect(await loadSheetForPrincipal(principal, sheet.id, "read")).not.toBeNull();

      await db.update(sheetAcls).set({ acl: "editor" }).where(eq(sheetAcls.id, acl.id));
      expect(await loadSheetForPrincipal(principal, sheet.id, "edit")).not.toBeNull();
      expect(await loadSheetForPrincipal(principal, sheet.id, "manage")).toBeNull();

      await db.update(sheetAcls).set({ acl: "manager" }).where(eq(sheetAcls.id, acl.id));
      expect(await loadSheetForPrincipal(principal, sheet.id, "manage")).not.toBeNull();
    } finally {
      await db.delete(sheets).where(eq(sheets.id, sheet.id));
    }
  });

  it("scopes distribution mutations by distribute capability and Region", () => {
    const pcmPrincipal = createPrincipal({
      user: pcm,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    const rpdPrincipal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region ?? pcm.region,
    });
    expect(() => assertPrincipalCanDistribute(pcmPrincipal, pcm.region!)).toThrow(DomainError);
    expect(() => assertPrincipalCanDistribute(rpdPrincipal, rpd.region ?? pcm.region!)).not.toThrow();
  });

  it("rejects unauthorized mobile write routes without UI affordances", async () => {
    const token = await session(leadership);
    const create = await pursuitsPost(
      request("http://localhost/api/v1/mobile/pursuits", token, {
        mode: "manual",
        jobName: "Should fail",
        region: pcm.region,
        preconDepartment: "Test",
        estimatePhase: "ROM",
        bidYear: 2026,
        initialStatus: "active",
      }),
    );
    expect([403, 404]).toContain(create.status);

    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `P6-MOB-${Date.now()}`,
        jobName: "Phase 6 mobile deny",
        region: pcm.region!,
        preconDepartment: "Test",
        createdById: pcm.id,
      })
      .returning();
    const [round] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 1,
        status: "active",
        region: pcm.region!,
        preconDepartment: "Test",
        estimatePhase: "ROM",
        bidYear: 2026,
        createdById: pcm.id,
      })
      .returning();
    try {
      const transition = await transitionPost(
        request(`http://localhost/api/v1/mobile/rounds/${round.id}/transition`, token, {
          to: "submitted",
        }),
        { params: Promise.resolve({ id: String(round.id) }) },
      );
      expect([403, 404]).toContain(transition.status);
    } finally {
      await deleteRoundTree(round.id, job.id);
    }
  });
});

describe("mutation service boundary inventory", () => {
  const source = (relative: string) =>
    fs.readFileSync(path.join(process.cwd(), relative), "utf8");

  it("routes write entrypoints through principal-aware services", () => {
    expect(source("src/actions/pursuits.ts")).toContain("pursuitService");
    expect(source("src/actions/post-bid.ts")).toContain("pursuitService");
    expect(source("src/actions/destini.ts")).toContain("pursuitService.savePostBidData");
    expect(source("src/actions/distribution.ts")).toContain("assertPrincipalCanDistribute");
    expect(source("src/app/api/v1/mobile/pursuits/route.ts")).toContain("principal.authorization");
    expect(source("src/app/api/v1/mobile/rounds/[id]/transition/route.ts")).toContain(
      "principal.authorization",
    );
    expect(source("src/services/pursuit-service.ts")).not.toMatch(
      /getCurrentUser|getMobileContext|runWithMobileContext/,
    );
    expect(source("src/services/mutation-policy.ts")).not.toMatch(
      /getCurrentUser|getMobileContext|runWithMobileContext/,
    );
  });
});
