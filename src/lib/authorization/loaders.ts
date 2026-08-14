import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  dashboards,
  customColumns,
  estimateRounds,
  fieldWritePolicies,
  jobs,
  savedReports,
  sheetAcls,
  sheets,
  users,
  type Dashboard,
  type CustomColumn,
  type EstimateRound,
  type Job,
  type SavedReportConfig,
  type Sheet,
  type User,
} from "@/db/schema";
import { authorize } from "./kernel";
import type { Capability, Principal, ResourceDescriptor } from "./types";

export type ResourceState = "active" | "deleted";
export type AuthorizedResource<T> = { value: T; descriptor: ResourceDescriptor };

export const ADMIN_SECTIONS = [
  "columns",
  "promotions",
  "lists",
  "review",
  "notifications",
  "distribution",
  "salesforce",
  "tokens",
  "access",
  "people",
  "audit",
  "integrations",
  "migration",
  "destini",
  "quality",
  "trash",
  "status",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

function statePredicate(column: AnyPgColumn, state: ResourceState): SQL {
  return state === "active" ? isNull(column) : isNotNull(column);
}

/** Reusable Region predicate included in every region-bearing resource query. */
export function principalRegionPredicate(
  column: AnyPgColumn,
  principal: Principal,
  includeCorporate = false,
): SQL | undefined {
  const scoped =
    principal.workspace.kind === "region"
      ? [principal.workspace.region]
      : principal.allowedRegions;
  const regional =
    scoped === "all"
      ? undefined
      : scoped.length === 0
        ? sql<boolean>`false`
        : scoped.length === 1
          ? eq(column, scoped[0]!)
          : inArray(column, [...scoped]);
  if (!includeCorporate) return regional;
  return regional ? or(isNull(column), regional) : undefined;
}

export async function loadJobForPrincipal(
  principal: Principal,
  id: number,
  capability: Capability = "read",
  state: ResourceState = "active",
): Promise<AuthorizedResource<Job> | null> {
  const [value] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), statePredicate(jobs.deletedAt, state), principalRegionPredicate(jobs.region, principal)));
  if (!value) return null;
  const descriptor: ResourceDescriptor = {
    type: "job",
    id: value.id,
    region: value.region,
    ownerId: value.createdById,
    published: true,
    deleted: value.deletedAt != null,
  };
  return authorize(principal, capability, descriptor).allowed ? { value, descriptor } : null;
}

/** All active pursuit rows are Region-scoped in SQL before auxiliary values load. */
export async function listRoundsWithJobsForPrincipal(
  principal: Principal,
): Promise<AuthorizedRound[]> {
  return db
    .select({ round: estimateRounds, job: jobs, estimateLeadName: users.name })
    .from(estimateRounds)
    .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
    .leftJoin(users, eq(estimateRounds.estimateLeadId, users.id))
    .where(
      and(
        isNull(estimateRounds.deletedAt),
        isNull(jobs.deletedAt),
        principalRegionPredicate(estimateRounds.region, principal),
      ),
    );
}

export type PipelineBucketCounts = {
  active: number;
  upcoming: number;
  outstanding: number;
};

/** Pre-bid bucket counts for the rail — region-scoped, no row payload. */
export async function countPreBidStatusesForPrincipal(
  principal: Principal,
): Promise<PipelineBucketCounts> {
  const rows = await db
    .select({
      status: estimateRounds.status,
      count: sql<number>`count(*)::int`,
    })
    .from(estimateRounds)
    .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
    .where(
      and(
        isNull(estimateRounds.deletedAt),
        isNull(jobs.deletedAt),
        inArray(estimateRounds.status, ["active", "upcoming", "outstanding"]),
        principalRegionPredicate(estimateRounds.region, principal),
      ),
    )
    .groupBy(estimateRounds.status);

  const counts: PipelineBucketCounts = { active: 0, upcoming: 0, outstanding: 0 };
  for (const row of rows) {
    if (row.status === "active" || row.status === "upcoming" || row.status === "outstanding") {
      counts[row.status] = Number(row.count);
    }
  }
  return counts;
}

export async function listDirectoryUsersForPrincipal(principal: Principal): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(principalRegionPredicate(users.region, principal, true))
    .orderBy(asc(users.id));
}

export async function listCustomColumnsForPrincipal(
  principal: Principal,
): Promise<CustomColumn[]> {
  return db
    .select()
    .from(customColumns)
    .where(
      or(
        eq(customColumns.scope, "company"),
        principalRegionPredicate(customColumns.region, principal),
      ),
    )
    .orderBy(asc(customColumns.id));
}

export type AuthorizedRound = {
  round: EstimateRound;
  job: Job;
  estimateLeadName: string | null;
};

export async function loadRoundForPrincipal(
  principal: Principal,
  id: number,
  options: { capability?: Capability; state?: ResourceState; fieldKey?: string } = {},
): Promise<AuthorizedResource<AuthorizedRound> | null> {
  const capability = options.capability ?? "read";
  const state = options.state ?? "active";
  const [value] = await db
    .select({ round: estimateRounds, job: jobs, estimateLeadName: users.name })
    .from(estimateRounds)
    .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
    .leftJoin(users, eq(estimateRounds.estimateLeadId, users.id))
    .where(
      and(
        eq(estimateRounds.id, id),
        statePredicate(estimateRounds.deletedAt, state),
        state === "active" ? isNull(jobs.deletedAt) : undefined,
        principalRegionPredicate(estimateRounds.region, principal),
      ),
    );
  if (!value) return null;
  const [fieldPolicy] = options.fieldKey
    ? await db
        .select()
        .from(fieldWritePolicies)
        .where(
          and(
            eq(fieldWritePolicies.fieldKey, options.fieldKey),
            eq(fieldWritePolicies.role, principal.user.role),
          ),
        )
        .limit(1)
    : [];
  const descriptor: ResourceDescriptor = {
    type: "round",
    id: value.round.id,
    region: value.round.region,
    ownerId: value.round.createdById,
    published: true,
    deleted: value.round.deletedAt != null,
    parent: {
      type: "job",
      id: value.job.id,
      region: value.job.region,
      ownerId: value.job.createdById,
      published: true,
      deleted: value.job.deletedAt != null,
    },
    round: { status: value.round.status, region: value.round.region },
    fieldKey: options.fieldKey,
    fieldPolicy: fieldPolicy
      ? {
          role: fieldPolicy.role,
          allowedStatuses: fieldPolicy.allowedStatuses,
          regionScoped: fieldPolicy.regionScoped,
        }
      : null,
  };
  return authorize(principal, capability, descriptor).allowed ? { value, descriptor } : null;
}

function requiredSheetAcls(capability: Capability) {
  if (capability === "manage") return ["manager"] as const;
  if (capability === "edit") return ["editor", "manager"] as const;
  return ["viewer", "editor", "manager"] as const;
}

function sheetAccessPredicate(principal: Principal, capability: Capability): SQL {
  const aclAudience = or(
    eq(sheetAcls.userId, principal.user.id),
    eq(sheetAcls.grantRole, principal.user.role),
  );
  const aclExists = sql<boolean>`exists (
    select 1 from ${sheetAcls}
    where ${eq(sheetAcls.sheetId, sheets.id)}
      and ${aclAudience}
      and ${inArray(sheetAcls.acl, [...requiredSheetAcls(capability)])}
  )`;
  if (capability === "manage" || capability === "restore" || capability === "permanent-delete") {
    return or(
      eq(sheets.ownerId, principal.user.id),
      sql<boolean>`${principal.user.role} = 'corporate_admin'`,
      and(
        sql<boolean>`${principal.user.role} = 'rpd'`,
        principal.user.region ? eq(sheets.region, principal.user.region) : sql<boolean>`false`,
      ),
      and(
        sql<boolean>`${principal.user.role} = 'admin_jsa'`,
        principalRegionPredicate(sheets.region, principal),
      ),
      aclExists,
    )!;
  }
  if (capability === "edit") {
    return or(
      eq(sheets.ownerId, principal.user.id),
      sql<boolean>`${principal.user.role} in ('pcm', 'estimate_lead', 'admin_jsa', 'rpd', 'corporate_admin')`,
      aclExists,
    )!;
  }
  return or(
    isNull(sheets.region),
    principalRegionPredicate(sheets.region, principal),
    sql<boolean>`${principal.user.role} = 'corporate_admin'`,
    aclExists,
  )!;
}

export async function listSheetsForPrincipal(
  principal: Principal,
  options: { archived?: boolean } = {},
): Promise<Sheet[]> {
  return db
    .select()
    .from(sheets)
    .where(
      and(
        isNull(sheets.deletedAt),
        options.archived ? isNotNull(sheets.archivedAt) : isNull(sheets.archivedAt),
        principalRegionPredicate(sheets.region, principal, true),
        sheetAccessPredicate(principal, "read"),
      ),
    )
    .orderBy(options.archived ? desc(sheets.archivedAt) : asc(sheets.name));
}

export async function searchSheetsForPrincipal(
  principal: Principal,
  pattern: string,
  limit = 10,
): Promise<Sheet[]> {
  return db
    .select()
    .from(sheets)
    .where(
      and(
        isNull(sheets.deletedAt),
        isNull(sheets.archivedAt),
        principalRegionPredicate(sheets.region, principal, true),
        sheetAccessPredicate(principal, "read"),
        or(
          ilike(sheets.name, pattern),
          ilike(sheets.folder, pattern),
          ilike(sheets.description, pattern),
        ),
      ),
    )
    .orderBy(asc(sheets.name))
    .limit(limit);
}

export async function loadSheetForPrincipal(
  principal: Principal,
  id: number,
  capability: Capability = "read",
  state: ResourceState = "active",
): Promise<AuthorizedResource<Sheet> | null> {
  const [value] = await db
    .select()
    .from(sheets)
    .where(
      and(
        eq(sheets.id, id),
        statePredicate(sheets.deletedAt, state),
        principalRegionPredicate(sheets.region, principal, true),
        sheetAccessPredicate(principal, capability),
      ),
    );
  if (!value) return null;
  const acls = await db.select().from(sheetAcls).where(eq(sheetAcls.sheetId, value.id));
  const descriptor: ResourceDescriptor = {
    type: "sheet",
    id: value.id,
    region: value.region,
    ownerId: value.ownerId,
    published: true,
    deleted: value.deletedAt != null,
    sheetAcls: acls,
  };
  return authorize(principal, capability, descriptor).allowed ? { value, descriptor } : null;
}

function dashboardVisibility(principal: Principal): SQL {
  const regionPublished = and(
    eq(dashboards.published, true),
    eq(dashboards.scope, "region"),
    principalRegionPredicate(dashboards.region, principal),
  );
  return or(
    eq(dashboards.ownerId, principal.user.id),
    sql<boolean>`${principal.user.role} = 'corporate_admin'`,
    regionPublished,
    and(eq(dashboards.published, true), eq(dashboards.scope, "corporate")),
  )!;
}

export async function listDashboardsForPrincipal(principal: Principal): Promise<Dashboard[]> {
  return db
    .select()
    .from(dashboards)
    .where(and(isNull(dashboards.deletedAt), dashboardVisibility(principal)))
    .orderBy(desc(dashboards.updatedAt));
}

export async function loadDashboardForPrincipal(
  principal: Principal,
  id: number,
  capability: Capability = "read",
  state: ResourceState = "active",
): Promise<AuthorizedResource<Dashboard> | null> {
  const [value] = await db
    .select()
    .from(dashboards)
    .where(
      and(
        eq(dashboards.id, id),
        statePredicate(dashboards.deletedAt, state),
        dashboardVisibility(principal),
      ),
    );
  if (!value) return null;
  const descriptor: ResourceDescriptor = {
    type: "dashboard",
    id: value.id,
    region: value.region,
    ownerId: value.ownerId,
    published: value.published,
    deleted: value.deletedAt != null,
    dashboardScope: value.scope,
  };
  return authorize(principal, capability, descriptor).allowed ? { value, descriptor } : null;
}

export type SavedReportValue = {
  id: number;
  name: string;
  ownerId: number;
  config: SavedReportConfig;
  sharedWithUserIds: number[] | null;
  sharedWithRegions: string[] | null;
  presetKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedById: number | null;
};

function reportVisibility(principal: Principal): SQL {
  const userShare = sql<boolean>`coalesce(${savedReports.sharedWithUserIds}, '[]'::jsonb) @> ${JSON.stringify([principal.user.id])}::jsonb`;
  const regionShare =
    principal.allowedRegions === "all"
      ? sql<boolean>`jsonb_array_length(coalesce(${savedReports.sharedWithRegions}, '[]'::jsonb)) > 0`
      : or(
          ...principal.allowedRegions.map(
            (region) => sql<boolean>`coalesce(${savedReports.sharedWithRegions}, '[]'::jsonb) @> ${JSON.stringify([region])}::jsonb`,
          ),
        );
  return or(
    eq(savedReports.ownerId, principal.user.id),
    sql<boolean>`${principal.user.role} = 'corporate_admin'`,
    userShare,
    regionShare,
  )!;
}

export async function listReportsForPrincipal(
  principal: Principal,
): Promise<SavedReportValue[]> {
  return db
    .select()
    .from(savedReports)
    .where(and(isNull(savedReports.deletedAt), reportVisibility(principal)))
    .orderBy(desc(savedReports.updatedAt));
}

export async function loadReportForPrincipal(
  principal: Principal,
  id: number,
  capability: Capability = "read",
  state: ResourceState = "active",
): Promise<AuthorizedResource<SavedReportValue> | null> {
  const [value] = await db
    .select()
    .from(savedReports)
    .where(and(eq(savedReports.id, id), statePredicate(savedReports.deletedAt, state), reportVisibility(principal)));
  if (!value) return null;
  const descriptor: ResourceDescriptor = {
    type: "report",
    id: value.id,
    region: null,
    ownerId: value.ownerId,
    published: Boolean(value.sharedWithUserIds?.length || value.sharedWithRegions?.length),
    deleted: value.deletedAt != null,
    sharedWithUserIds: value.sharedWithUserIds ?? [],
    sharedWithRegions: value.sharedWithRegions ?? [],
  };
  return authorize(principal, capability, descriptor).allowed ? { value, descriptor } : null;
}

export async function loadAdminSectionForPrincipal(
  principal: Principal,
  section: string,
  capability: Capability = "read",
): Promise<AuthorizedResource<{ section: string }> | null> {
  const descriptor: ResourceDescriptor = {
    type: "admin",
    id: section,
    region: principal.workspace.region,
    ownerId: null,
    published: false,
    deleted: false,
    adminSection: section,
  };
  return authorize(principal, capability, descriptor).allowed
    ? { value: { section }, descriptor }
    : null;
}

export async function listAdminSectionsForPrincipal(
  principal: Principal,
): Promise<AdminSection[]> {
  const decisions = await Promise.all(
    ADMIN_SECTIONS.map(async (section) => ({
      section,
      allowed: Boolean(await loadAdminSectionForPrincipal(principal, section)),
    })),
  );
  return decisions.filter((decision) => decision.allowed).map((decision) => decision.section);
}

export type TrashEntity = "job" | "round" | "sheet" | "dashboard" | "report";

export async function loadTrashForPrincipal(
  principal: Principal,
  entity: TrashEntity,
  id: number,
  capability: "read" | "restore" | "permanent-delete",
): Promise<AuthorizedResource<unknown> | null> {
  // Deleted rows only pass authorize() for restore/permanent-delete (deleted-state).
  // Load with restore for SQL + region scope; final capability is checked on trash descriptor.
  const loadCapability: Capability = "restore";
  const loaded =
    entity === "job"
      ? await loadJobForPrincipal(principal, id, loadCapability, "deleted")
      : entity === "round"
        ? await loadRoundForPrincipal(principal, id, { capability: loadCapability, state: "deleted" })
        : entity === "sheet"
          ? await loadSheetForPrincipal(principal, id, loadCapability, "deleted")
          : entity === "dashboard"
            ? await loadDashboardForPrincipal(principal, id, loadCapability, "deleted")
            : await loadReportForPrincipal(principal, id, loadCapability, "deleted");
  if (!loaded) return null;
  const descriptor: ResourceDescriptor = {
    type: "trash",
    id,
    region: loaded.descriptor.region,
    ownerId: loaded.descriptor.ownerId,
    published: false,
    deleted: true,
    parent: loaded.descriptor,
  };
  return authorize(principal, capability, descriptor).allowed
    ? { value: loaded.value, descriptor }
    : null;
}
