import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { db, ensureDbReady } from "@/db";
import {
  apiTokens,
  dashboards,
  estimateRounds,
  jobs,
  sheetAcls,
  sheets,
  users,
} from "@/db/schema";
import { GET as jobGet } from "@/app/api/v1/mobile/jobs/[id]/route";
import { GET as roundGet } from "@/app/api/v1/mobile/rounds/[id]/route";
import { GET as dashboardGet } from "@/app/api/v1/mobile/dashboards/[id]/route";
import { GET as dashboardsGet } from "@/app/api/v1/mobile/dashboards/route";
import { GET as sheetGet } from "@/app/api/v1/mobile/sheets/[id]/route";
import { GET as sheetsGet } from "@/app/api/v1/mobile/sheets/route";
import { GET as adminGet } from "@/app/api/v1/mobile/admin/route";
import { GET as sheetExportGet } from "@/app/api/export/sheet/route";
import { GET as statusExportGet } from "@/app/api/export/status/route";
import { GET as dashboardExportGet } from "@/app/api/export/dashboard/route";
import { GET as bidScheduleExportGet } from "@/app/api/export/bid-schedule/route";
import { GET as annualExportGet } from "@/app/api/export/annual/route";
import { createPrincipal } from "@/lib/authorization/principal";
import { loadSheetForPrincipal } from "@/lib/authorization/loaders";
import { issueDemoSession } from "@/lib/mobile-auth";
import { DEMO_USER_COOKIE } from "@/lib/current-user";
import { WORKSPACE_COOKIE } from "@/lib/workspace";
import {
  readMobileAdminSection,
  type MobileAdminQueries,
} from "@/lib/mobile-admin";

let pcm: typeof users.$inferSelect;
let corporateAdmin: typeof users.$inferSelect;
const issuedTokenHashes: string[] = [];

async function session(user: typeof users.$inferSelect) {
  const issued = await issueDemoSession(user.id);
  if ("error" in issued) throw new Error(issued.error);
  issuedTokenHashes.push(issued.token);
  return issued.token;
}

function request(url: string, token: string) {
  return new Request(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-workspace-region": pcm.region ?? "Central",
    },
  });
}

beforeAll(async () => {
  await ensureDbReady();
  [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
  [corporateAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "corporate_admin"))
    .limit(1);
  if (!pcm || !corporateAdmin || !pcm.region) throw new Error("Required seeded roles are missing");
});

afterAll(async () => {
  for (const plaintext of issuedTokenHashes) {
    const { hashToken } = await import("@/lib/api-tokens");
    await db.delete(apiTokens).where(eq(apiTokens.tokenHash, hashToken(plaintext)));
  }
});

describe("resource access HTTP matrix", () => {
  it("returns not-found for cross-Region job and round IDs on mobile", async () => {
    const token = await session(pcm);
    const otherRegion = pcm.region === "Florida" ? "Central" : "Florida";
    const createdJobs = await db
      .insert(jobs)
      .values([
        {
          jobNumber: `P5-SAME-${Date.now()}`,
          jobName: "Phase 5 same Region",
          region: pcm.region!,
          preconDepartment: "Test",
          createdById: pcm.id,
        },
        {
          jobNumber: `P5-CROSS-${Date.now()}`,
          jobName: "Phase 5 cross Region",
          region: otherRegion,
          preconDepartment: "Test",
          createdById: corporateAdmin.id,
        },
      ])
      .returning();
    const createdRounds = await db
      .insert(estimateRounds)
      .values(
        createdJobs.map((job) => ({
          jobId: job.id,
          roundNumber: 1,
          status: "active" as const,
          region: job.region,
          preconDepartment: job.preconDepartment,
          estimatePhase: "ROM",
          bidYear: 2026,
          createdById: job.createdById,
        })),
      )
      .returning();

    try {
      expect(
        (
          await jobGet(request(`http://localhost/api/v1/mobile/jobs/${createdJobs[0].id}`, token), {
            params: Promise.resolve({ id: String(createdJobs[0].id) }),
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await jobGet(request(`http://localhost/api/v1/mobile/jobs/${createdJobs[1].id}`, token), {
            params: Promise.resolve({ id: String(createdJobs[1].id) }),
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await roundGet(
            request(`http://localhost/api/v1/mobile/rounds/${createdRounds[0].id}`, token),
            { params: Promise.resolve({ id: String(createdRounds[0].id) }) },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await roundGet(
            request(`http://localhost/api/v1/mobile/rounds/${createdRounds[1].id}`, token),
            { params: Promise.resolve({ id: String(createdRounds[1].id) }) },
          )
        ).status,
      ).toBe(404);
    } finally {
      for (const round of createdRounds) {
        await db.delete(estimateRounds).where(eq(estimateRounds.id, round.id));
      }
      for (const job of createdJobs) await db.delete(jobs).where(eq(jobs.id, job.id));
    }
  });

  it("returns not-found for cross-Region web pages and sheet exports", async () => {
    const otherRegion = pcm.region === "Florida" ? "Central" : "Florida";
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `P5-WEB-${Date.now()}`,
        jobName: "Phase 5 web cross Region",
        region: otherRegion,
        preconDepartment: "Test",
        createdById: corporateAdmin.id,
      })
      .returning();
    const [round] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 1,
        status: "active",
        region: otherRegion,
        preconDepartment: "Test",
        estimatePhase: "ROM",
        bidYear: 2026,
        createdById: corporateAdmin.id,
      })
      .returning();
    const [sheet] = await db
      .insert(sheets)
      .values({
        kind: "grid",
        name: `Phase 5 web sheet ${Date.now()}`,
        region: otherRegion,
        ownerId: corporateAdmin.id,
      })
      .returning();
    const store = await cookies();
    store.set(DEMO_USER_COOKIE, String(pcm.id));
    store.set(WORKSPACE_COOKIE, pcm.region!);

    try {
      const { default: JobPage } = await import("@/app/(app)/jobs/[id]/page");
      const { default: RoundPage } = await import("@/app/(app)/rounds/[id]/page");
      for (const render of [
        () => JobPage({ params: Promise.resolve({ id: String(job.id) }) }),
        () => RoundPage({ params: Promise.resolve({ id: String(round.id) }) }),
      ]) {
        try {
          await render();
          throw new Error("Expected not-found");
        } catch (error) {
          const digest =
            error && typeof error === "object" && "digest" in error
              ? String(error.digest)
              : String(error);
          expect(digest).toMatch(/404|not.?found/i);
        }
      }

      const exported = await sheetExportGet(
        new NextRequest(`http://localhost/api/export/sheet?id=${sheet.id}`),
      );
      expect(exported.status).toBe(404);
      expect(await statusExportGet(new NextRequest("http://localhost/api/export/status"))).toMatchObject({
        status: 404,
      });

      const other = pcm.region === "Florida" ? "Central" : "Florida";
      const dash = await dashboardExportGet(
        new NextRequest(
          `http://localhost/api/export/dashboard?level=region&region=${encodeURIComponent(other)}`,
        ),
      );
      expect(dash.status).toBe(403);
      const bid = await bidScheduleExportGet(
        new NextRequest(
          `http://localhost/api/export/bid-schedule?region=${encodeURIComponent(other)}&config=${encodeURIComponent(JSON.stringify({ columns: ["jobName"] }))}`,
        ),
      );
      expect(bid.status).toBe(403);
      const annual = await annualExportGet(
        new NextRequest(
          `http://localhost/api/export/annual?region=${encodeURIComponent(other)}&format=xlsx`,
        ),
      );
      expect(annual.status).toBe(403);
    } finally {
      await db.delete(sheets).where(eq(sheets.id, sheet.id));
      await db.delete(estimateRounds).where(eq(estimateRounds.id, round.id));
      await db.delete(jobs).where(eq(jobs.id, job.id));
    }
  });

  it("keeps private dashboards owner-only in detail and list responses", async () => {
    const token = await session(pcm);
    const created = await db
      .insert(dashboards)
      .values([
        {
          name: `Phase 5 own ${Date.now()}`,
          scope: "personal",
          ownerId: pcm.id,
          published: false,
        },
        {
          name: `Phase 5 private ${Date.now()}`,
          scope: "personal",
          ownerId: corporateAdmin.id,
          published: false,
        },
      ])
      .returning();
    try {
      expect(
        (
          await dashboardGet(
            request(`http://localhost/api/v1/mobile/dashboards/${created[0].id}`, token),
            { params: Promise.resolve({ id: String(created[0].id) }) },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await dashboardGet(
            request(`http://localhost/api/v1/mobile/dashboards/${created[1].id}`, token),
            { params: Promise.resolve({ id: String(created[1].id) }) },
          )
        ).status,
      ).toBe(404);

      const list = await dashboardsGet(
        request("http://localhost/api/v1/mobile/dashboards", token),
      );
      const body = (await list.json()) as { studio: { id: number }[] };
      expect(body.studio.map((dashboard) => dashboard.id)).toContain(created[0].id);
      expect(body.studio.map((dashboard) => dashboard.id)).not.toContain(created[1].id);
    } finally {
      for (const dashboard of created) {
        await db.delete(dashboards).where(eq(dashboards.id, dashboard.id));
      }
    }
  });

  it("enforces sheet Region, list visibility, and viewer/manager ACLs", async () => {
    const token = await session(pcm);
    const otherRegion = pcm.region === "Florida" ? "Central" : "Florida";
    const created = await db
      .insert(sheets)
      .values([
        {
          kind: "grid",
          name: `Phase 5 ACL ${Date.now()}`,
          region: null,
          ownerId: corporateAdmin.id,
        },
        {
          kind: "grid",
          name: `Phase 5 cross ${Date.now()}`,
          region: otherRegion,
          ownerId: corporateAdmin.id,
        },
      ])
      .returning();
    const [acl] = await db
      .insert(sheetAcls)
      .values({ sheetId: created[0].id, userId: pcm.id, acl: "viewer" })
      .returning();
    const principal = createPrincipal({
      user: pcm,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    try {
      const visible = await sheetGet(
        request(`http://localhost/api/v1/mobile/sheets/${created[0].id}`, token),
        { params: Promise.resolve({ id: String(created[0].id) }) },
      );
      expect(visible.status).toBe(200);
      expect(((await visible.json()) as { data: { canManage: boolean } }).data.canManage).toBe(false);

      const denied = await sheetGet(
        request(`http://localhost/api/v1/mobile/sheets/${created[1].id}`, token),
        { params: Promise.resolve({ id: String(created[1].id) }) },
      );
      expect(denied.status).toBe(404);

      const list = await sheetsGet(request("http://localhost/api/v1/mobile/sheets", token));
      const ids = ((await list.json()) as { data: { id: number }[] }).data.map((sheet) => sheet.id);
      expect(ids).toContain(created[0].id);
      expect(ids).not.toContain(created[1].id);

      expect(await loadSheetForPrincipal(principal, created[0].id, "manage")).toBeNull();
      await db.update(sheetAcls).set({ acl: "manager" }).where(eq(sheetAcls.id, acl.id));
      expect(await loadSheetForPrincipal(principal, created[0].id, "manage")).not.toBeNull();
    } finally {
      for (const sheet of created) await db.delete(sheets).where(eq(sheets.id, sheet.id));
    }
  });
});

describe("admin query-before-authorization boundary", () => {
  it("runs no sensitive section query for a denied principal", async () => {
    const principal = createPrincipal({
      user: pcm,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    const query = vi.fn(async () => []);
    const queries: MobileAdminQueries = {
      lists: query,
      columns: query,
      audit: query,
      salesforce: query,
    };
    const result = await readMobileAdminSection(principal, "audit", queries);
    expect(result).toEqual({ ok: false, status: 404 });
    expect(query).not.toHaveBeenCalled();

    const token = await session(pcm);
    expect(
      (await adminGet(request("http://localhost/api/v1/mobile/admin?section=index", token))).status,
    ).toBe(404);
  });

  it("exposes only entitled admin index sections", async () => {
    const token = await session(corporateAdmin);
    const response = await adminGet(
      new Request("http://localhost/api/v1/mobile/admin?section=index", {
        headers: { authorization: `Bearer ${token}`, "x-workspace-region": "corporate" },
      }),
    );
    expect(response.status).toBe(200);
    const keys = ((await response.json()) as { sections: { key: string }[] }).sections.map(
      (section) => section.key,
    );
    expect(keys).toEqual(expect.arrayContaining(["tokens", "access", "status", "audit"]));
  });
});

describe("scoped-read migration inventory", () => {
  const source = (relative: string) =>
    fs.readFileSync(path.join(process.cwd(), relative), "utf8");

  it("keeps predictable-ID pages and routes behind a parent loader", () => {
    const expectations = [
      ["src/app/(app)/jobs/[id]/page.tsx", "loadJobForPrincipal"],
      ["src/app/(app)/rounds/[id]/page.tsx", "loadRoundForPrincipal"],
      ["src/app/(app)/sheets/[id]/page.tsx", "loadSheetForPrincipal"],
      ["src/app/(app)/dashboards/studio/[id]/page.tsx", "loadDashboardForPrincipal"],
      ["src/app/api/v1/mobile/jobs/[id]/route.ts", "authorizationService.readJob"],
      ["src/app/api/v1/mobile/rounds/[id]/route.ts", "authorizationService.readRound"],
      ["src/app/api/v1/mobile/sheets/[id]/route.ts", "loadSheetForPrincipal"],
      ["src/app/api/v1/mobile/dashboards/[id]/route.ts", "authorizationService.readDashboard"],
    ] as const;
    for (const [file, loader] of expectations) expect(source(file), file).toContain(loader);
  });

  it("removes unscoped aggregate and export entry points", () => {
    const appSource = [
      ...walk("src/app"),
      "src/lib/sheets-server.ts",
      "src/actions/reports.ts",
    ]
      .map(source)
      .join("\n");
    expect(appSource).not.toMatch(/getRoundsWithJobs\(workspace\)/);
    expect(appSource).not.toMatch(/getFlatDataset\(\)/);
    expect(source("src/app/api/v1/mobile/admin/route.ts")).not.toContain(".from(");
    expect(source("src/app/(app)/dashboards/studio/page.tsx")).toContain(
      "listDashboardsForPrincipal",
    );
    expect(source("src/app/api/export/sheet/route.ts")).not.toContain("getSheet(");
    expect(source("src/app/api/export/dashboard/route.ts")).toContain("listRoundsWithJobsForPrincipal");
    expect(source("src/app/api/export/dashboard/route.ts")).toContain("resolveRegionParam");
    expect(source("src/app/api/export/bid-schedule/route.ts")).toContain("getWebPrincipal");
    expect(source("src/app/api/export/bid-schedule/route.ts")).toContain("resolveRegionParam");
    expect(source("src/app/api/export/annual/route.ts")).toContain("resolveRegionParam");
    expect(source("src/app/api/export/pptx/route.ts")).toContain("getWebPrincipal");
    expect(source("src/app/api/export/report/route.ts")).toContain("getFlatDataset");
    expect(source("src/app/api/v1/ai/magnus/route.ts")).toContain("listRoundsWithJobsForPrincipal");
  });

  function walk(relative: string): string[] {
    const root = path.join(process.cwd(), relative);
    const files: string[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) files.push(...walk(child));
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(child);
    }
    return files;
  }
});
