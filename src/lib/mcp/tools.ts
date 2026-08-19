import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { DomainError } from "@/domain/errors";
import {
  loadJobForPrincipal,
  loadRoundForPrincipal,
} from "@/lib/authorization/loaders";
import type { GrantableMcpScope } from "@/lib/authorization/mcp-scopes";
import type { Principal } from "@/lib/authorization/types";
import { EMPTY_HIERARCHY } from "@/lib/bid-schedule-filter";
import { copilotQueryService } from "@/services/copilot-query-service";
import {
  appendNoteForMcp,
  MCP_PURSUIT_FIELD_ALLOWLIST,
  updatePursuitFieldsForMcp,
} from "@/services/mcp-write-service";

export type McpToolDef = {
  name: string;
  requiredScope: GrantableMcpScope;
};

export const MCP_READ_TOOLS: readonly McpToolDef[] = [
  { name: "whoami", requiredScope: "profile:read" },
  { name: "query_efforts", requiredScope: "read:pursuits" },
  { name: "query_needs_staffing", requiredScope: "read:pursuits" },
  { name: "search_notes", requiredScope: "read:pursuits" },
  { name: "person_history", requiredScope: "read:pursuits" },
  { name: "get_job", requiredScope: "read:pursuits" },
  { name: "get_round", requiredScope: "read:pursuits" },
  { name: "plan_chart", requiredScope: "read:dashboards" },
];

export const MCP_WRITE_TOOLS: readonly McpToolDef[] = [
  { name: "append_note", requiredScope: "write:pursuits" },
  { name: "update_pursuit_fields", requiredScope: "write:pursuits" },
];

export const MCP_WRITE_TOOL_NAMES = MCP_WRITE_TOOLS.map((tool) => tool.name);

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

function errorResult(message: string) {
  return {
    isError: true as const,
    content: [
      { type: "text" as const, text: JSON.stringify({ error: message }) },
    ],
  };
}

function fromDomainError(error: unknown) {
  if (error instanceof DomainError) return errorResult(error.what);
  throw error;
}

export function createPreconMcpServer(
  principal: Principal,
  effectiveScopes: readonly string[]
): McpServer {
  const allowed = new Set(effectiveScopes);
  const server = new McpServer({
    name: "precon-data-collection",
    version: "1.0.0",
  });

  const has = (scope: GrantableMcpScope) => allowed.has(scope);

  if (has("profile:read")) {
    server.registerTool(
      "whoami",
      {
        title: "Who am I",
        description:
          "Return the signed-in Precon user's name, role, home region, workspace, and the MCP scopes currently in effect. Use this first to confirm identity and grants.",
        inputSchema: z.object({}),
      },
      async () =>
        textResult({
          user: {
            id: principal.user.id,
            name: principal.user.name,
            role: principal.user.role,
            region: principal.user.region,
            title: principal.user.title,
            email: principal.user.email,
          },
          workspace: principal.workspace,
          allowedRegions: principal.allowedRegions,
          effectiveScopes,
        })
    );
  }

  if (has("read:pursuits")) {
    server.registerTool(
      "query_efforts",
      {
        title: "Query efforts",
        description:
          "List estimate rounds (efforts) the user can see. Optional filters: status, homeRegion, department, bidYear.",
        inputSchema: z.object({
          status: z.string().optional(),
          homeRegion: z.string().optional(),
          department: z.string().optional(),
          bidYear: z.number().int().optional(),
        }),
      },
      async (input) => {
        const rows = await copilotQueryService.queryEfforts(principal, input);
        return textResult({ count: rows.length, efforts: rows });
      }
    );

    server.registerTool(
      "query_needs_staffing",
      {
        title: "Needs staffing",
        description:
          "List upcoming efforts that still need a staffing assignment, scoped to the user's visible jobs.",
        inputSchema: z.object({
          regions: z.array(z.string()).optional(),
          departments: z.array(z.string()).optional(),
        }),
      },
      async (input) => {
        const hierarchy =
          input.regions?.length || input.departments?.length
            ? {
                regions: input.regions ?? [],
                departments: input.departments ?? [],
              }
            : EMPTY_HIERARCHY;
        const rows = await copilotQueryService.queryNeedsStaffing(
          principal,
          hierarchy
        );
        return textResult({ count: rows.length, efforts: rows });
      }
    );

    server.registerTool(
      "search_notes",
      {
        title: "Search notes",
        description:
          "Search effort notes the user can read. Returns short excerpts plus job/round citations for deep links.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(50).optional(),
        }),
      },
      async (input) => {
        const hits = await copilotQueryService.searchNotes(
          principal,
          input.query,
          input.limit ?? 20
        );
        return textResult({ count: hits.length, notes: hits });
      }
    );

    server.registerTool(
      "person_history",
      {
        title: "Person history",
        description:
          "Find efforts a person led or staffed in a bid year. Identify them by userId or name.",
        inputSchema: z.object({
          year: z.number().int(),
          userId: z.number().int().optional(),
          name: z.string().optional(),
        }),
      },
      async (input) => {
        const result = await copilotQueryService.personHistory(
          principal,
          input
        );
        return textResult(result);
      }
    );

    server.registerTool(
      "get_job",
      {
        title: "Get job",
        description:
          "Load one job by id if the user can see it. Returns not_found when it is out of region or missing.",
        inputSchema: z.object({ id: z.number().int() }),
      },
      async (input) => {
        const loaded = await loadJobForPrincipal(principal, input.id);
        if (!loaded) return errorResult("Job not found or not visible.");
        return textResult({ job: loaded.value });
      }
    );

    server.registerTool(
      "get_round",
      {
        title: "Get round",
        description:
          "Load one estimate round by id, with its parent job, if the user can see it.",
        inputSchema: z.object({ id: z.number().int() }),
      },
      async (input) => {
        const loaded = await loadRoundForPrincipal(principal, input.id);
        if (!loaded) return errorResult("Round not found or not visible.");
        return textResult({
          round: loaded.value.round,
          job: loaded.value.job,
          estimateLeadName: loaded.value.estimateLeadName,
        });
      }
    );
  }

  if (has("read:dashboards")) {
    server.registerTool(
      "plan_chart",
      {
        title: "Plan chart",
        description:
          "Draft a dashboard chart plan from a natural-language intent. Does not save. Returns widget titles and a preview spec.",
        inputSchema: z.object({ intent: z.string() }),
      },
      async (input) => {
        const result = await copilotQueryService.planChart(
          principal,
          input.intent
        );
        return textResult(result);
      }
    );
  }

  if (has("write:pursuits")) {
    server.registerTool(
      "append_note",
      {
        title: "Append note",
        description:
          "Add a note to an estimate round. Confirm the roundId with the user before writing. Appending the same text twice creates two notes (not idempotent). Mentions use @[userId] tokens; users who cannot read the round are not notified.",
        inputSchema: z.object({
          roundId: z.number().int(),
          body: z.string(),
        }),
      },
      async (input) => {
        try {
          const note = await appendNoteForMcp(
            principal,
            input.roundId,
            input.body
          );
          return textResult({
            noteId: note.id,
            roundId: note.roundId,
            createdAt: note.createdAt,
          });
        } catch (error) {
          return fromDomainError(error);
        }
      }
    );

    server.registerTool(
      "update_pursuit_fields",
      {
        title: "Update pursuit fields",
        description: `Update allowlisted fields on an estimate round. Last-write-wins, same as the mobile PUT. Confirm roundId and fields with the user before writing. Allowed fields: ${MCP_PURSUIT_FIELD_ALLOWLIST.join(", ")}. Cannot change status, outcome, region, lock, or estimate lead.`,
        inputSchema: z.object({
          roundId: z.number().int(),
          fields: z.record(z.string(), z.string()),
        }),
      },
      async (input) => {
        try {
          const result = await updatePursuitFieldsForMcp(
            principal,
            input.roundId,
            input.fields
          );
          return textResult({ roundId: input.roundId, ...result });
        } catch (error) {
          return fromDomainError(error);
        }
      }
    );
  }

  return server;
}
