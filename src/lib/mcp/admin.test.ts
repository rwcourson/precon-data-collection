import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { afterAll, describe, expect, it } from "vitest";
import { setMcpKillSwitch, setMcpRoleDefaults } from "@/actions/mcp";
import { db } from "@/db";
import {
  user as authUser,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
} from "@/db/auth-schema";
import { appSettings, auditLog, users } from "@/db/schema";
import { listAdminSectionsForPrincipal } from "@/lib/authorization/loaders";
import {
  DEFAULT_MCP_ADMIN_CONFIG,
  MCP_READ_SCOPES,
} from "@/lib/authorization/mcp-policy";
import {
  MCP_SETTINGS_KEY,
  saveMcpAdminConfig,
} from "@/lib/authorization/mcp-settings";
import { createPrincipal } from "@/lib/authorization/principal";
import { DEMO_USER_COOKIE } from "@/lib/current-user";
import { revokeMcpConsent } from "@/lib/mcp/connections";
import { handleMcpWithClaims } from "@/lib/mcp/handler";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

async function asUser(userId: number, region: string | null) {
  const store = await cookies();
  store.set(DEMO_USER_COOKIE, String(userId));
  store.set(WORKSPACE_COOKIE, region ?? "corporate");
}

describe("MCP admin controls", () => {
  afterAll(async () => {
    await db.delete(appSettings).where(eq(appSettings.key, MCP_SETTINGS_KEY));
    await db.delete(auditLog).where(eq(auditLog.entity, "mcp_tool"));
  });

  it("non-corporate_admin does not receive the mcp admin section", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const [corp] = await db
      .select()
      .from(users)
      .where(eq(users.role, "corporate_admin"))
      .limit(1);
    const pcmSections = await listAdminSectionsForPrincipal(
      createPrincipal({
        user: pcm,
        authSource: "sso",
        workspaceRegion: pcm.region,
      })
    );
    const corpSections = await listAdminSectionsForPrincipal(
      createPrincipal({
        user: corp,
        authSource: "sso",
        workspaceRegion: null,
      })
    );
    expect(pcmSections).not.toContain("mcp");
    expect(corpSections).toContain("mcp");
  });

  it("MCP admin actions reject a non-corporate_admin principal", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    await asUser(pcm.id, pcm.region);
    await expect(setMcpKillSwitch(false)).rejects.toThrow(/not permitted/i);
  });

  it("kill switch toggle denies a previously-working MCP request", async () => {
    const [corp] = await db
      .select()
      .from(users)
      .where(eq(users.role, "corporate_admin"))
      .limit(1);
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    await asUser(corp.id, null);
    await setMcpKillSwitch(true);

    const rpc = () =>
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });
    const claims = {
      sub: "ba-pcm",
      email: pcm.email,
      scope: "profile:read",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const before = await handleMcpWithClaims(rpc(), claims);
    expect(before.status).toBe(200);

    await setMcpKillSwitch(false);
    const after = await handleMcpWithClaims(rpc(), claims);
    expect(after.status).toBe(403);
    expect(await after.text()).toMatch(/disabled/i);

    await setMcpKillSwitch(true);
  });

  it("role-default change alters effective scopes on the next request", async () => {
    const [corp] = await db
      .select()
      .from(users)
      .where(eq(users.role, "corporate_admin"))
      .limit(1);
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    await asUser(corp.id, null);
    await setMcpRoleDefaults({
      ...DEFAULT_MCP_ADMIN_CONFIG.roleDefaults,
      pcm: ["profile:read"],
    });
    const listed = await handleMcpWithClaims(
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      }),
      {
        sub: "ba-pcm",
        email: pcm.email,
        scope: "profile:read read:pursuits read:dashboards",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }
    );
    const text = await listed.text();
    expect(text).toContain("whoami");
    expect(text).not.toContain("query_efforts");
    await setMcpRoleDefaults({
      ...DEFAULT_MCP_ADMIN_CONFIG.roleDefaults,
      pcm: [...MCP_READ_SCOPES],
    });
  });

  it("revoking a consent invalidates that client's access token", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const now = new Date();
    const authUserId = `auth-${pcm.id}`;
    const clientId = `client-${pcm.id}`;
    const consentId = `consent-${pcm.id}`;
    const jti = `jti-${pcm.id}`;
    await db
      .insert(authUser)
      .values({
        id: authUserId,
        name: pcm.name,
        email: `ba-${pcm.email}`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db
      .insert(oauthClient)
      .values({
        id: clientId,
        clientId,
        name: "MCP Inspector",
        redirectUris: ["http://127.0.0.1/cb"],
      })
      .onConflictDoNothing();
    await db
      .insert(oauthConsent)
      .values({
        id: consentId,
        clientId,
        userId: authUserId,
        scopes: ["profile:read"],
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db
      .insert(oauthAccessToken)
      .values({
        id: jti,
        token: `tok-${jti}`,
        clientId,
        userId: authUserId,
        scopes: ["profile:read"],
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt: now,
      })
      .onConflictDoNothing();

    const claims = {
      sub: authUserId,
      email: pcm.email,
      scope: "profile:read",
      jti,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const alive = await handleMcpWithClaims(
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      }),
      claims
    );
    expect(alive.status).toBe(200);

    expect(await revokeMcpConsent(consentId)).toBe(true);
    const dead = await handleMcpWithClaims(
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      }),
      claims
    );
    expect(dead.status).toBe(401);
    expect(dead.headers.get("www-authenticate")?.toLowerCase()).toContain(
      "bearer"
    );

    await db.delete(oauthAccessToken).where(eq(oauthAccessToken.id, jti));
    await db.delete(oauthClient).where(eq(oauthClient.clientId, clientId));
    await db.delete(authUser).where(eq(authUser.id, authUserId));
  });

  it("records audit rows for an allowed and a denied MCP tool call", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    await saveMcpAdminConfig(DEFAULT_MCP_ADMIN_CONFIG);
    await db.delete(auditLog).where(eq(auditLog.entity, "mcp_tool"));

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    await handleMcpWithClaims(
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "whoami", arguments: {} },
        }),
      }),
      {
        sub: "ba-pcm",
        email: pcm.email,
        scope: "profile:read",
        azp: "inspector",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }
    );
    await handleMcpWithClaims(
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "append_note", arguments: { roundId: 1, body: "x" } },
        }),
      }),
      {
        sub: "ba-pcm",
        email: pcm.email,
        scope: "profile:read write:pursuits",
        azp: "inspector",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }
    );

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entity, "mcp_tool"));
    expect(
      rows.some((row) => row.field === "whoami" && row.action === "allowed")
    ).toBe(true);
    expect(
      rows.some(
        (row) =>
          row.field === "append_note" &&
          row.action === "denied" &&
          row.newValue === "scope_denied"
      )
    ).toBe(true);
    expect(rows[0]?.userId).toBe(pcm.id);
    expect(rows[0]?.oldValue).toBe("inspector");
  });
});

describe("MCP admin UI states", () => {
  it("admin and connections surfaces include empty, loading, and error copy", async () => {
    const { readFileSync } = await import("node:fs");
    const admin = readFileSync(
      "src/components/admin/mcp-access-panel.tsx",
      "utf8"
    );
    const connections = readFileSync(
      "src/components/settings/mcp-connections-client.tsx",
      "utf8"
    );
    expect(admin).toMatch(/No per-user overrides/);
    expect(admin).toMatch(/No AI tools are connected yet/);
    expect(admin).toMatch(/Loader2/);
    expect(admin).toMatch(/Could not save MCP settings/);
    expect(connections).toMatch(/No AI tools connected yet/);
    expect(connections).toMatch(/Loader2/);
    expect(connections).toMatch(/Could not update connections/);
  });
});
