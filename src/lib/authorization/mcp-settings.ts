import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, mcpUserAccess } from "@/db/schema";
import {
  DEFAULT_MCP_ADMIN_CONFIG,
  type McpAdminConfig,
  type McpUserOverride,
  parseMcpAdminConfig,
} from "@/lib/authorization/mcp-policy";

export const MCP_SETTINGS_KEY = "mcp";

export async function loadMcpGrantState(userId: number): Promise<{
  adminConfig: McpAdminConfig;
  userOverride: McpUserOverride | null;
}> {
  const [settingsRow, overrideRow] = await Promise.all([
    db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, MCP_SETTINGS_KEY))
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(mcpUserAccess)
      .where(eq(mcpUserAccess.userId, userId))
      .then((rows) => rows[0] ?? null),
  ]);
  return {
    adminConfig: settingsRow
      ? parseMcpAdminConfig(settingsRow.value)
      : DEFAULT_MCP_ADMIN_CONFIG,
    userOverride: overrideRow
      ? {
          enabled: overrideRow.enabled,
          scopeCeiling: overrideRow.scopeCeiling,
        }
      : null,
  };
}

export async function loadMcpAdminConfig(): Promise<McpAdminConfig> {
  const [settingsRow] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, MCP_SETTINGS_KEY))
    .limit(1);
  return settingsRow
    ? parseMcpAdminConfig(settingsRow.value)
    : DEFAULT_MCP_ADMIN_CONFIG;
}

export async function saveMcpAdminConfig(
  config: McpAdminConfig
): Promise<void> {
  const value = {
    enabled: config.enabled,
    roleDefaults: config.roleDefaults,
  };
  await db
    .insert(appSettings)
    .values({ key: MCP_SETTINGS_KEY, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function listMcpUserOverrides() {
  return db.select().from(mcpUserAccess);
}

export async function upsertMcpUserOverride(input: {
  userId: number;
  enabled: boolean | null;
  scopeCeiling: string[] | null;
  updatedById: number;
}): Promise<void> {
  if (input.enabled == null && input.scopeCeiling == null) {
    await db
      .delete(mcpUserAccess)
      .where(eq(mcpUserAccess.userId, input.userId));
    return;
  }
  await db
    .insert(mcpUserAccess)
    .values({
      userId: input.userId,
      enabled: input.enabled,
      scopeCeiling: input.scopeCeiling,
      updatedById: input.updatedById,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: mcpUserAccess.userId,
      set: {
        enabled: input.enabled,
        scopeCeiling: input.scopeCeiling,
        updatedById: input.updatedById,
        updatedAt: new Date(),
      },
    });
}
