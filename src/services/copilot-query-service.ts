import "server-only";
import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { estimateRounds, roundNotes, users } from "@/db/schema";
import type { User } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import {
  listDirectoryUsersForPrincipal,
  listRoundsWithJobsForPrincipal,
  type AuthorizedRound,
} from "@/lib/authorization/loaders";
import { createPrincipal } from "@/lib/authorization/principal";
import type { Principal } from "@/lib/authorization/types";
import {
  isCopilotToolName,
  type CopilotToolName,
} from "@/lib/ai/copilot-bridge";
import { EMPTY_HIERARCHY, type HierarchySelection } from "@/lib/bid-schedule-filter";
import { planDashboardFromPrompt } from "@/lib/dashboard-copilot";
import { resolveWidgets } from "@/lib/dashboard-query";
import { filterNeedsStaffing } from "@/lib/staffing";

export type CopilotEffortRow = {
  roundId: number;
  jobId: number;
  jobNumber: string;
  jobName: string;
  status: string;
  homeRegion: string;
  preconDepartment: string;
  bidDueDate: string | null;
  bidYear: number;
  estimateLeadId: number | null;
  estimateLeadName: string | null;
  teamAssignedAt: string | null;
  teamAssignedById: number | null;
};

export type CopilotNoteHit = {
  noteId: number;
  roundId: number;
  jobNumber: string;
  jobName: string;
  authorName: string;
  createdAt: string;
  excerpt: string;
  citation: string;
};

function toEffort(row: AuthorizedRound): CopilotEffortRow {
  return {
    roundId: row.round.id,
    jobId: row.job.id,
    jobNumber: row.job.jobNumber,
    jobName: row.job.jobName,
    status: row.round.status,
    homeRegion: row.job.region,
    preconDepartment: row.round.preconDepartment,
    bidDueDate: row.round.bidDueDate,
    bidYear: row.round.bidYear,
    estimateLeadId: row.round.estimateLeadId,
    estimateLeadName: row.estimateLeadName,
    teamAssignedAt: row.round.teamAssignedAt?.toISOString() ?? null,
    teamAssignedById: row.round.teamAssignedById,
  };
}

function yearOf(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const match = String(value).match(/^(\d{4})/);
    return match ? Number(match[1]) : null;
  }
  return date.getFullYear();
}

/** Principal-scoped copilot reads. Identity is the explicit Principal — never ambient. */
export const copilotQueryService = {
  async principalForUserId(userId: number, workspaceRegion?: string | null): Promise<Principal> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw DomainError.notFound("User not found");
    return createPrincipal({
      user,
      authSource: "service",
      workspaceRegion: workspaceRegion === undefined ? user.region : workspaceRegion,
    });
  },

  async queryEfforts(
    principal: Principal,
    filters: {
      status?: string;
      homeRegion?: string;
      department?: string;
      bidYear?: number;
    } = {},
  ): Promise<CopilotEffortRow[]> {
    const listed = await listRoundsWithJobsForPrincipal(principal);
    return listed
      .map(toEffort)
      .filter((row) => (filters.status ? row.status === filters.status : true))
      .filter((row) => (filters.homeRegion ? row.homeRegion === filters.homeRegion : true))
      .filter((row) => (filters.department ? row.preconDepartment === filters.department : true))
      .filter((row) => (filters.bidYear != null ? row.bidYear === filters.bidYear : true));
  },

  async queryNeedsStaffing(
    principal: Principal,
    hierarchy: HierarchySelection = EMPTY_HIERARCHY,
  ): Promise<CopilotEffortRow[]> {
    const listed = await listRoundsWithJobsForPrincipal(principal);
    const rows = listed.map(toEffort);
    return filterNeedsStaffing(rows, hierarchy);
  },

  async searchNotes(principal: Principal, query: string, limit = 20): Promise<CopilotNoteHit[]> {
    const listed = await listRoundsWithJobsForPrincipal(principal);
    const byRound = new Map(listed.map((row) => [row.round.id, row]));
    const roundIds = [...byRound.keys()];
    if (roundIds.length === 0) return [];

    // Strip LIKE wildcards so user input can't broaden the pattern
    // (same sanitation as src/app/api/search/route.ts).
    const trimmed = query.trim().replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim();
    const rows = await db
      .select({
        noteId: roundNotes.id,
        roundId: roundNotes.roundId,
        body: roundNotes.body,
        createdAt: roundNotes.createdAt,
        authorName: users.name,
      })
      .from(roundNotes)
      .innerJoin(users, eq(roundNotes.authorUserId, users.id))
      .innerJoin(estimateRounds, eq(roundNotes.roundId, estimateRounds.id))
      .where(
        and(
          inArray(roundNotes.roundId, roundIds),
          isNull(roundNotes.deletedAt),
          isNull(estimateRounds.deletedAt),
          trimmed ? ilike(roundNotes.body, `%${trimmed}%`) : undefined,
        ),
      )
      .orderBy(desc(roundNotes.createdAt))
      .limit(limit);

    return rows.flatMap((row) => {
      const effort = byRound.get(row.roundId);
      if (!effort) return [];
      const excerpt = row.body.replace(/\s+/g, " ").trim().slice(0, 220);
      return [
        {
          noteId: row.noteId,
          roundId: row.roundId,
          jobNumber: effort.job.jobNumber,
          jobName: effort.job.jobName,
          authorName: row.authorName,
          createdAt: row.createdAt.toISOString(),
          excerpt,
          citation: `${effort.job.jobNumber} · ${effort.job.jobName} · round ${effort.round.id}`,
        },
      ];
    });
  },

  async personHistory(
    principal: Principal,
    input: { userId?: number; name?: string; year: number },
  ): Promise<{ person: { id: number; name: string } | null; efforts: CopilotEffortRow[] }> {
    const directory = await listDirectoryUsersForPrincipal(principal);
    const listed = await listRoundsWithJobsForPrincipal(principal);
    const person = matchDirectoryUser(directory, input);
    if (!person) return { person: null, efforts: [] };

    const efforts = listed
      .map(toEffort)
      .filter((row) => {
        const lead = row.estimateLeadId === person.id;
        const staffed = row.teamAssignedById === person.id;
        if (!lead && !staffed) return false;
        const assignedYear = yearOf(row.teamAssignedAt);
        return row.bidYear === input.year || assignedYear === input.year;
      });
    return { person: { id: person.id, name: person.name }, efforts };
  },

  async planChart(principal: Principal, intent: string) {
    const listed = await listRoundsWithJobsForPrincipal(principal);
    const rounds = listed.map((row) => row.round);
    const plan = planDashboardFromPrompt(intent);
    const widgets = resolveWidgets(plan.widgets, rounds);
    return {
      plan,
      widgets,
      widgetCount: plan.widgets.length,
      previewTitles: plan.widgets.map((widget) => widget.title),
    };
  },

  async execute(
    principal: Principal,
    tool: string,
    input: Record<string, unknown>,
  ) {
    if (!isCopilotToolName(tool)) {
      throw DomainError.badRequest(`Unknown copilot tool: ${tool}`);
    }
    return dispatchTool(principal, tool, input);
  },
};

function matchDirectoryUser(
  directory: User[],
  input: { userId?: number; name?: string },
): User | undefined {
  if (input.userId != null) {
    return directory.find((user) => user.id === input.userId);
  }
  const needle = input.name?.trim().toLowerCase();
  if (!needle) return undefined;
  return (
    directory.find((user) => user.name.toLowerCase() === needle) ??
    directory.find((user) => user.name.toLowerCase().includes(needle))
  );
}

async function dispatchTool(
  principal: Principal,
  tool: CopilotToolName,
  input: Record<string, unknown>,
) {
  switch (tool) {
    case "query_efforts":
      return copilotQueryService.queryEfforts(principal, {
        status: typeof input.status === "string" ? input.status : undefined,
        homeRegion: typeof input.homeRegion === "string" ? input.homeRegion : undefined,
        department: typeof input.department === "string" ? input.department : undefined,
        bidYear: typeof input.bidYear === "number" ? input.bidYear : undefined,
      });
    case "query_needs_staffing":
      return copilotQueryService.queryNeedsStaffing(principal, {
        regions: Array.isArray(input.regions) ? input.regions.map(String) : [],
        departments: Array.isArray(input.departments) ? input.departments.map(String) : [],
      });
    case "search_notes":
      return copilotQueryService.searchNotes(
        principal,
        typeof input.query === "string" ? input.query : "",
      );
    case "person_history":
      return copilotQueryService.personHistory(principal, {
        userId: typeof input.userId === "number" ? input.userId : undefined,
        name: typeof input.name === "string" ? input.name : undefined,
        year: typeof input.year === "number" ? input.year : 2026,
      });
    case "plan_chart":
      return copilotQueryService.planChart(
        principal,
        typeof input.intent === "string" ? input.intent : "region scorecard",
      );
  }
}
