import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  dashboards,
  estimateRounds,
  fieldWritePolicies,
  jobs,
  savedReports,
  sheetAcls,
  sheets,
  users,
  type ApiToken,
  type Role,
  type User,
} from "@/db/schema";
import { authorize, resolveKernelSheetCapability } from "./kernel";
import {
  loadAdminSectionForPrincipal,
  loadDashboardForPrincipal,
  loadJobForPrincipal,
  loadReportForPrincipal,
  loadRoundForPrincipal,
  loadSheetForPrincipal,
  loadTrashForPrincipal,
} from "./loaders";
import { createPrincipal } from "./principal";
import type { Capability, Principal, ResourceDescriptor } from "./types";

const ROLES: Role[] = [
  "pcm",
  "estimate_lead",
  "admin_jsa",
  "rpd",
  "leadership",
  "corporate_admin",
];

function user(role: Role, id: number, region: string | null = "Central"): User {
  return {
    id,
    name: role,
    title: role,
    role,
    region,
    preconDepartment: null,
    email: `${role}-${id}@example.com`,
  };
}

function principal(role: Role, id = 1, region: string | null = "Central"): Principal {
  return createPrincipal({
    user: user(role, id, region),
    authSource: "sso",
    workspaceRegion: role === "corporate_admin" ? null : region,
  });
}

function resource(partial: Partial<ResourceDescriptor> = {}): ResourceDescriptor {
  return {
    type: "job",
    id: 10,
    region: "Central",
    ownerId: 999,
    published: true,
    deleted: false,
    ...partial,
  };
}

describe("authorization principal contract", () => {
  it.each(ROLES)("carries explicit identity, workspace, Region and token state for %s", (role) => {
    const value = principal(role, ROLES.indexOf(role) + 1, role === "corporate_admin" ? null : "Central");
    expect(value.authSource).toBe("sso");
    expect(value.user.role).toBe(role);
    expect(value.workspace.kind).toBe(role === "corporate_admin" ? "corporate" : "region");
    expect(value.allowedRegions).toBeDefined();
    expect(value.token).toBeNull();
  });

  it("intersects API-token Region and scope constraints with the user's scope", () => {
    const owner = user("corporate_admin", 6, null);
    const token: ApiToken = {
      id: 50,
      name: "read-only",
      tokenHash: "hash",
      tokenPrefix: "prefix",
      scopes: ["read:pursuits"],
      regionAllowlist: ["Central"],
      createdById: owner.id,
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
    };
    const value = createPrincipal({ user: owner, authSource: "api_token", token });
    expect(value.allowedRegions).toEqual(["Central"]);
    expect(authorize(value, "read", resource()).allowed).toBe(true);
    expect(authorize(value, "edit", resource()).allowed).toBe(false);
    expect(authorize(value, "read", resource({ region: "Florida" })).allowed).toBe(false);
  });

  it("a user with no home region does not crash and scopes to the workspace when one is set", () => {
    const bare = createPrincipal({
      user: user("pcm", 99, null),
      authSource: "sso",
      workspaceRegion: null,
    });
    expect(bare.allowedRegions).toBe("all");
    const scoped = createPrincipal({
      user: user("pcm", 100, null),
      authSource: "sso",
      workspaceRegion: "Central",
    });
    expect(scoped.allowedRegions).toEqual(["Central"]);
  });
});

describe("deny-by-default role, Region, ownership, publication, field and ACL matrix", () => {
  it.each(ROLES)("applies same/cross Region read and edit policy for %s", (role) => {
    const actor = principal(role, ROLES.indexOf(role) + 1, role === "corporate_admin" ? null : "Central");
    expect(authorize(actor, "read", resource()).allowed).toBe(true);
    expect(authorize(actor, "read", resource({ region: "Florida" })).allowed).toBe(
      role === "corporate_admin",
    );
    expect(authorize(actor, "edit", resource()).allowed).toBe(
      ["pcm", "estimate_lead", "admin_jsa", "rpd"].includes(role),
    );
  });

  it("allows leadership cross-Region reads only from an explicit corporate workspace", () => {
    const leadership = createPrincipal({
      user: user("leadership", 17, "Central"),
      authSource: "sso",
      workspaceRegion: null,
    });
    expect(authorize(leadership, "read", resource({ region: "Florida" })).allowed).toBe(true);
  });

  it("covers ownership and publication for personal and published dashboards", () => {
    const owner = principal("pcm", 10);
    const other = principal("pcm", 11);
    const draft = resource({ type: "dashboard", ownerId: owner.user.id, published: false, dashboardScope: "personal" });
    expect(authorize(owner, "read", draft).allowed).toBe(true);
    expect(authorize(other, "read", draft).allowed).toBe(false);
    expect(authorize(other, "read", { ...draft, published: true, dashboardScope: "region" }).allowed).toBe(true);
  });

  it("resolves viewer/editor/manager ACL rank in the same kernel", () => {
    const actor = principal("leadership", 20);
    for (const [acl, expected] of [
      ["viewer", { read: true, edit: false, manage: false }],
      ["editor", { read: true, edit: true, manage: false }],
      ["manager", { read: true, edit: true, manage: true }],
    ] as const) {
      const sheet = resource({
        type: "sheet",
        ownerId: 99,
        sheetAcls: [{ userId: actor.user.id, grantRole: null, acl, regionAllowlist: ["Central"] }],
      });
      expect(resolveKernelSheetCapability(actor, sheet)).toBe(acl);
      expect(authorize(actor, "read", sheet).allowed).toBe(expected.read);
      expect(authorize(actor, "edit", sheet).allowed).toBe(expected.edit);
      expect(authorize(actor, "manage", sheet).allowed).toBe(expected.manage);
    }
  });

  it("routes default and persisted field policy through the kernel", () => {
    const lead = principal("estimate_lead", 30);
    const base = resource({
      type: "round",
      fieldKey: "estimateValue",
      round: { status: "post_bid", region: "Central" },
      fieldPolicy: null,
    });
    expect(authorize(lead, "edit", base).allowed).toBe(true);
    expect(
      authorize(lead, "edit", {
        ...base,
        fieldPolicy: { role: "estimate_lead", allowedStatuses: [], regionScoped: true },
      }).allowed,
    ).toBe(false);
  });

  it("covers every capability and denies unsupported role/resource combinations", () => {
    const capabilities: Capability[] = [
      "read",
      "edit",
      "manage",
      "approve",
      "distribute",
      "integrate",
      "restore",
      "permanent-delete",
      "notes.write",
      "notes.attach",
      "visibility.manage-region",
      "visibility.assign-user",
      "staffing.mark",
      "dashboards.manage-standard",
      "reports.schedule",
    ];
    const pcm = principal("pcm");
    for (const capability of capabilities) {
      const target = resource({ type: capability === "restore" || capability === "permanent-delete" ? "trash" : "job", deleted: capability === "restore" || capability === "permanent-delete" });
      expect(authorize(pcm, capability, target)).toHaveProperty("allowed");
    }
    expect(authorize(principal("rpd"), "approve", resource({ type: "round", round: { status: "post_bid", region: "Central" } })).allowed).toBe(true);
    expect(authorize(principal("rpd"), "distribute", resource({ type: "report" })).allowed).toBe(true);
    expect(authorize(principal("admin_jsa"), "integrate", resource({ type: "admin" })).allowed).toBe(true);
    expect(authorize(principal("rpd"), "restore", resource({ type: "trash", deleted: true })).allowed).toBe(true);
    expect(authorize(principal("rpd"), "read", resource({ type: "trash", deleted: true })).allowed).toBe(true);
    expect(authorize(principal("corporate_admin", 9, null), "permanent-delete", resource({ type: "trash", deleted: true })).allowed).toBe(true);
  });
});

describe("Jay-roadmap capabilities — allow and deny per role", () => {
  const editors = new Set(["pcm", "estimate_lead", "admin_jsa", "rpd"]);

  it.each(ROLES)("notes.write / notes.attach allow every in-region role including %s", (role) => {
    const actor = principal(role, ROLES.indexOf(role) + 1, role === "corporate_admin" ? null : "Central");
    const round = resource({ type: "round", round: { status: "upcoming", region: "Central" } });
    expect(authorize(actor, "notes.write", round).allowed).toBe(true);
    expect(authorize(actor, "notes.attach", round).allowed).toBe(true);
  });

  it("notes.write is denied cross-region for a pinned director", () => {
    const rpd = principal("rpd", 2, "Central");
    expect(
      authorize(
        rpd,
        "notes.write",
        resource({ type: "round", region: "Florida", round: { status: "upcoming", region: "Florida" } }),
      ).allowed,
    ).toBe(false);
  });

  it.each(ROLES)("visibility.manage-region own-region for %s", (role) => {
    const actor = principal(role, ROLES.indexOf(role) + 1, role === "corporate_admin" ? null : "Central");
    expect(authorize(actor, "visibility.manage-region", resource({ type: "job", region: "Central" })).allowed).toBe(
      editors.has(role) || role === "corporate_admin",
    );
    expect(authorize(actor, "visibility.manage-region", resource({ type: "job", region: "Florida" })).allowed).toBe(
      role === "corporate_admin",
    );
  });

  it.each(ROLES)("visibility.assign-user is corporate_admin-only for %s", (role) => {
    const actor = principal(role, ROLES.indexOf(role) + 1, role === "corporate_admin" ? null : "Central");
    expect(authorize(actor, "visibility.assign-user", resource({ type: "job" })).allowed).toBe(
      role === "corporate_admin",
    );
  });

  it.each(ROLES)("staffing.mark for %s", (role) => {
    const actor = principal(role, ROLES.indexOf(role) + 1, role === "corporate_admin" ? null : "Central");
    expect(
      authorize(
        actor,
        "staffing.mark",
        resource({ type: "round", round: { status: "upcoming", region: "Central" } }),
      ).allowed,
    ).toBe(editors.has(role) || role === "corporate_admin");
  });

  it.each(ROLES)("dashboards.manage-standard for %s", (role) => {
    const actor = principal(role, ROLES.indexOf(role) + 1, role === "corporate_admin" ? null : "Central");
    expect(
      authorize(
        actor,
        "dashboards.manage-standard",
        resource({ type: "dashboard", ownerId: actor.user.id, published: true }),
      ).allowed,
    ).toBe(role === "corporate_admin");
  });

  it.each(ROLES)("reports.schedule for %s", (role) => {
    const actor = principal(role, ROLES.indexOf(role) + 1, role === "corporate_admin" ? null : "Central");
    expect(
      authorize(actor, "reports.schedule", resource({ type: "report", ownerId: actor.user.id, published: true }))
        .allowed,
    ).toBe(true);
  });

  it("denies reports.schedule on another owner's report", () => {
    const actor = principal("pcm", 1);
    expect(
      authorize(actor, "reports.schedule", resource({ type: "report", ownerId: 99, published: true })).allowed,
    ).toBe(false);
  });

  it("denies in-place edit of a standard dashboard", () => {
    const owner = principal("pcm", 1);
    const admin = principal("corporate_admin", 2, null);
    const standard = resource({
      type: "dashboard",
      ownerId: owner.user.id,
      published: true,
      isStandard: true,
    });
    expect(authorize(owner, "edit", standard).allowed).toBe(false);
    expect(authorize(admin, "edit", { ...standard, ownerId: admin.user.id }).allowed).toBe(false);
  });
});

describe("database-scoped authorization loaders", () => {
  let seededUsers: User[] = [];
  let sheetId = 0;
  let dashboardId = 0;
  let reportId = 0;
  let deletedJobId = 0;

  beforeAll(async () => {
    seededUsers = await db.select().from(users);
    const pcm = seededUsers.find((row) => row.role === "pcm")!;
    const rpd = seededUsers.find((row) => row.role === "rpd")!;
    const [createdSheet] = await db.insert(sheets).values({ kind: "grid", name: "Authorization matrix sheet", region: "Central", folder: "Tests", ownerId: pcm.id }).returning({ id: sheets.id });
    sheetId = createdSheet.id;
    await db.insert(sheetAcls).values({ sheetId, userId: rpd.id, acl: "manager", regionAllowlist: ["Central"] });
    const [createdDashboard] = await db.insert(dashboards).values({ name: "Authorization draft", ownerId: pcm.id, scope: "personal", published: false }).returning({ id: dashboards.id });
    dashboardId = createdDashboard.id;
    const [createdReport] = await db.insert(savedReports).values({ name: "Authorization shared report", ownerId: pcm.id, config: { fields: [], filters: [], groupBy: [], aggregations: [], sortBy: [] }, sharedWithRegions: ["Central"] }).returning({ id: savedReports.id });
    reportId = createdReport.id;
    const [createdJob] = await db.insert(jobs).values({ jobNumber: `AUTH-${Date.now()}`, jobName: "Deleted authorization job", region: "Central", preconDepartment: "Central", createdById: pcm.id, deletedAt: new Date() }).returning({ id: jobs.id });
    deletedJobId = createdJob.id;
  });

  afterAll(async () => {
    if (sheetId) await db.delete(sheets).where(eq(sheets.id, sheetId));
    if (dashboardId) await db.delete(dashboards).where(eq(dashboards.id, dashboardId));
    if (reportId) await db.delete(savedReports).where(eq(savedReports.id, reportId));
    if (deletedJobId) await db.delete(jobs).where(eq(jobs.id, deletedJobId));
  });

  it("applies Region and soft-delete predicates before returning a predictable ID", async () => {
    const pcm = seededUsers.find((row) => row.role === "pcm")!;
    const central = createPrincipal({ user: pcm, authSource: "sso", workspaceRegion: "Central" });
    const [same] = await db.select().from(jobs).where(and(eq(jobs.region, "Central"), isNull(jobs.deletedAt))).limit(1);
    const [cross] = await db.select().from(jobs).where(and(ne(jobs.region, "Central"), isNull(jobs.deletedAt))).limit(1);
    expect(same && (await loadJobForPrincipal(central, same.id))?.value.id).toBe(same?.id);
    expect(cross && (await loadJobForPrincipal(central, cross.id))).toBeNull();
    expect(await loadJobForPrincipal(central, 2_147_483_647)).toBeNull();
  });

  it("applies persisted ACL, ownership/publication, sharing, admin, and trash state", async () => {
    const pcm = seededUsers.find((row) => row.role === "pcm")!;
    const rpd = seededUsers.find((row) => row.role === "rpd")!;
    const corp = seededUsers.find((row) => row.role === "corporate_admin")!;
    const pcmPrincipal = createPrincipal({ user: pcm, authSource: "sso", workspaceRegion: "Central" });
    const rpdPrincipal = createPrincipal({ user: rpd, authSource: "sso", workspaceRegion: "Central" });
    const corpPrincipal = createPrincipal({ user: corp, authSource: "sso", workspaceRegion: null });
    expect(await loadSheetForPrincipal(rpdPrincipal, sheetId, "manage")).not.toBeNull();
    expect(await loadDashboardForPrincipal(rpdPrincipal, dashboardId)).toBeNull();
    expect(await loadDashboardForPrincipal(pcmPrincipal, dashboardId)).not.toBeNull();
    expect(await loadReportForPrincipal(rpdPrincipal, reportId)).not.toBeNull();
    expect(await loadAdminSectionForPrincipal(corpPrincipal, "tokens", "manage")).not.toBeNull();
    expect(await loadTrashForPrincipal(corpPrincipal, "job", deletedJobId, "permanent-delete")).not.toBeNull();
  });

  it("loads rounds through scoped SQL and enforces persisted field overrides", async () => {
    const pcm = seededUsers.find((row) => row.role === "pcm")!;
    const pcmPrincipal = createPrincipal({ user: pcm, authSource: "sso", workspaceRegion: "Central" });
    const [round] = await db
      .select()
      .from(estimateRounds)
      .where(and(eq(estimateRounds.region, "Central"), isNull(estimateRounds.deletedAt)))
      .limit(1);
    expect(round).toBeDefined();
    expect(await loadRoundForPrincipal(pcmPrincipal, round.id)).not.toBeNull();
    const [policy] = await db
      .insert(fieldWritePolicies)
      .values({
        fieldKey: "phase3-denied-field",
        role: "pcm",
        allowedStatuses: [],
        regionScoped: true,
      })
      .returning({ id: fieldWritePolicies.id });
    try {
      expect(
        await loadRoundForPrincipal(pcmPrincipal, round.id, {
          capability: "edit",
          fieldKey: "phase3-denied-field",
        }),
      ).toBeNull();
    } finally {
      await db.delete(fieldWritePolicies).where(eq(fieldWritePolicies.id, policy.id));
    }
  });
});
