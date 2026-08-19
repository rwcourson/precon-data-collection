import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appSettings, mcpUserAccess, type Role, type User } from "@/db/schema";
import { apiTokenScopeSchema } from "@/domain/contracts";
import { authorize } from "./kernel";
import {
  DEFAULT_MCP_ADMIN_CONFIG,
  effectiveMcpScopes,
  GRANTABLE_MCP_SCOPES,
  MCP_READ_SCOPES,
  MCP_ROLES,
  mcpCeilingForUser,
  NEVER_GRANTABLE,
  NEVER_GRANTABLE_SET,
  parseMcpAdminConfig,
} from "./mcp-policy";
import { GRANTABLE_MCP_SCOPE_SET } from "./mcp-scopes";
import { loadMcpGrantState, MCP_SETTINGS_KEY } from "./mcp-settings";
import { createMcpPrincipal } from "./principal";
import type { ResourceDescriptor } from "./types";

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

function job(): ResourceDescriptor {
  return {
    type: "job",
    id: 10,
    region: "Central",
    ownerId: 999,
    published: true,
    deleted: false,
  };
}

function round(): ResourceDescriptor {
  return {
    type: "round",
    id: 20,
    region: "Central",
    ownerId: 999,
    published: true,
    deleted: false,
  };
}

describe("MCP grant ceiling policy", () => {
  it("locks NEVER_GRANTABLE as every ApiTokenScope outside the grantable six", () => {
    expect(GRANTABLE_MCP_SCOPES).toEqual([
      "profile:read",
      "read:pursuits",
      "write:pursuits",
      "read:reports",
      "read:dashboards",
      "read:sheets",
    ]);
    expect(GRANTABLE_MCP_SCOPES).toHaveLength(6);
    const complement = apiTokenScopeSchema.options.filter(
      (scope) => !GRANTABLE_MCP_SCOPE_SET.has(scope)
    );
    expect([...NEVER_GRANTABLE].sort()).toEqual([...complement].sort());
    expect(NEVER_GRANTABLE).toEqual(
      expect.arrayContaining([
        "write:destructive",
        "read:admin",
        "write:admin",
        "admin:tokens",
        "read:trash",
        "write:trash",
        "read:notifications",
        "write:notifications",
        "integrate:connect",
      ])
    );
  });

  it("strips never-grantable scopes even when they appear in granted scopes", () => {
    const ceiling = [
      ...MCP_READ_SCOPES,
      "write:pursuits",
      "write:destructive",
      "read:admin",
    ];
    const granted = [
      "read:pursuits",
      "write:pursuits",
      "write:destructive",
      "admin:tokens",
      "read:notifications",
    ];
    expect(
      mcpCeilingForUser(
        user("corporate_admin", 1, null),
        {
          enabled: true,
          roleDefaults: DEFAULT_MCP_ADMIN_CONFIG.roleDefaults,
        },
        { enabled: true, scopeCeiling: ceiling }
      )
    ).toEqual([...MCP_READ_SCOPES, "write:pursuits"]);
    expect(effectiveMcpScopes(ceiling, granted)).toEqual([
      "read:pursuits",
      "write:pursuits",
    ]);
    for (const denied of NEVER_GRANTABLE) {
      expect(effectiveMcpScopes(GRANTABLE_MCP_SCOPES, [denied])).toEqual([]);
      expect(NEVER_GRANTABLE_SET.has(denied)).toBe(true);
    }
  });

  it("kill switch yields empty scopes for every role including corporate_admin", () => {
    const off = { ...DEFAULT_MCP_ADMIN_CONFIG, enabled: false };
    for (const role of MCP_ROLES) {
      expect(
        mcpCeilingForUser(
          user(role, 1, role === "corporate_admin" ? null : "Central"),
          off,
          {
            enabled: true,
            scopeCeiling: [...GRANTABLE_MCP_SCOPES],
          }
        )
      ).toEqual([]);
    }
  });

  it("per-user override beats role default; absent override falls back; unset config is reads-on/writes-off", () => {
    const unset = parseMcpAdminConfig(undefined);
    expect(unset).toEqual(DEFAULT_MCP_ADMIN_CONFIG);
    for (const role of MCP_ROLES) {
      expect(unset.roleDefaults[role]).toEqual([...MCP_READ_SCOPES]);
      expect(unset.roleDefaults[role]).not.toContain("write:pursuits");
      expect(mcpCeilingForUser(user(role, 2), unset, null)).toEqual([
        ...MCP_READ_SCOPES,
      ]);
    }

    const pcm = user("pcm", 3);
    const overrideWrites = mcpCeilingForUser(pcm, unset, {
      enabled: null,
      scopeCeiling: ["read:pursuits", "write:pursuits"],
    });
    expect(overrideWrites).toEqual(["read:pursuits", "write:pursuits"]);
    expect(
      mcpCeilingForUser(pcm, unset, {
        enabled: false,
        scopeCeiling: [...GRANTABLE_MCP_SCOPES],
      })
    ).toEqual([]);
    expect(
      mcpCeilingForUser(pcm, unset, { enabled: true, scopeCeiling: null })
    ).toEqual([...MCP_READ_SCOPES]);
  });

  it("MCP principal always has token !== null", () => {
    const principal = createMcpPrincipal({
      user: user("pcm", 4),
      tokenRef: "oauth-access-token-abc",
      scopes: ["read:pursuits"],
    });
    expect(principal.authSource).toBe("mcp");
    expect(principal.token).not.toBeNull();
    expect(principal.token?.tokenId).toBe("oauth-access-token-abc");
    expect(principal.token?.scopes).toEqual(["read:pursuits"]);
  });

  it("authorize denies a write capability when the MCP token lacks write:pursuits even though the role allows it", () => {
    const pcm = createMcpPrincipal({
      user: user("pcm", 5),
      tokenRef: "tok-read",
      scopes: ["read:pursuits"],
    });
    expect(authorize(pcm, "edit", job())).toMatchObject({
      allowed: false,
      reason: "token",
    });
    expect(authorize(pcm, "notes.write", round())).toMatchObject({
      allowed: false,
      reason: "token",
    });

    const pcmWrite = createMcpPrincipal({
      user: user("pcm", 6),
      tokenRef: "tok-write",
      scopes: ["read:pursuits", "write:pursuits"],
    });
    expect(authorize(pcmWrite, "edit", job()).allowed).toBe(true);
    expect(authorize(pcmWrite, "notes.write", round()).allowed).toBe(true);
  });

  it("authorize denies when the role forbids even though MCP scopes allow (leadership + write)", () => {
    const leadership = createMcpPrincipal({
      user: user("leadership", 7),
      tokenRef: "tok-lead-write",
      scopes: ["read:pursuits", "write:pursuits"],
      workspaceRegion: null,
    });
    expect(authorize(leadership, "edit", job())).toMatchObject({
      allowed: false,
      reason: "role",
    });
  });
});

describe("MCP grant storage", () => {
  const testUserId = 1;

  afterAll(async () => {
    await db.delete(mcpUserAccess).where(eq(mcpUserAccess.userId, testUserId));
    await db.delete(appSettings).where(eq(appSettings.key, MCP_SETTINGS_KEY));
  });

  it("mcp_user_access and app_settings.mcp round-trip on PGlite", async () => {
    await db
      .insert(appSettings)
      .values({
        key: MCP_SETTINGS_KEY,
        value: {
          enabled: true,
          roleDefaults: { pcm: ["read:pursuits", "write:pursuits"] },
        },
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: {
            enabled: true,
            roleDefaults: { pcm: ["read:pursuits", "write:pursuits"] },
          },
        },
      });
    await db.delete(mcpUserAccess).where(eq(mcpUserAccess.userId, testUserId));
    await db.insert(mcpUserAccess).values({
      userId: testUserId,
      enabled: true,
      scopeCeiling: ["profile:read"],
    });

    const state = await loadMcpGrantState(testUserId);
    expect(state.adminConfig.enabled).toBe(true);
    expect(state.adminConfig.roleDefaults.pcm).toEqual([
      "read:pursuits",
      "write:pursuits",
    ]);
    expect(state.userOverride).toEqual({
      enabled: true,
      scopeCeiling: ["profile:read"],
    });
    expect(
      mcpCeilingForUser(
        user("pcm", testUserId),
        state.adminConfig,
        state.userOverride
      )
    ).toEqual(["profile:read"]);
  });
});
