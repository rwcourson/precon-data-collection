import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { McpAccessTokenClaims } from "@/lib/mcp/claims";

export type McpToolDecision = "allowed" | "denied";

export async function recordMcpToolAudit(input: {
  userId: number;
  clientId: string;
  tool: string;
  decision: McpToolDecision;
  reason?: string;
}): Promise<void> {
  await db.insert(auditLog).values({
    entity: "mcp_tool",
    entityId: input.userId,
    action: input.decision,
    field: input.tool,
    oldValue: input.clientId,
    newValue: input.reason ?? null,
    userId: input.userId,
  });
}

export function mcpClientIdFromClaims(claims: McpAccessTokenClaims): string {
  for (const value of [claims.azp, claims.client_id, claims.aud]) {
    if (typeof value === "string" && value.length > 0) return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return "unknown";
}
