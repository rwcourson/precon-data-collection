import { and, eq, isNull, ne } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { POST as mcpPost } from "@/app/api/mcp/route";
import { db } from "@/db";
import { user as authUser } from "@/db/auth-schema";
import {
  appSettings,
  estimateRounds,
  jobs,
  mcpUserAccess,
  roundNotes,
  type User,
  users,
} from "@/db/schema";
import { MCP_SETTINGS_KEY } from "@/lib/authorization/mcp-settings";
import type { McpAccessTokenClaims } from "@/lib/mcp/claims";
import { handleMcpWithClaims, MAX_MCP_BODY_BYTES } from "@/lib/mcp/handler";

function claimsFor(
  user: Pick<User, "email">,
  scopes: string[],
  extra: Partial<McpAccessTokenClaims> = {}
): McpAccessTokenClaims {
  return {
    sub: `ba-${user.email}`,
    email: user.email,
    scope: scopes.join(" "),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...extra,
  };
}

async function parseMcpResponse(
  response: Response
): Promise<Record<string, unknown>> {
  const text = await response.text();
  const trimmed = text.trim();
  if (
    trimmed.startsWith("event:") ||
    trimmed.includes("\ndata:") ||
    trimmed.startsWith("data:")
  ) {
    const payloads = trimmed
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line.length > 0 && line !== "[DONE]");
    const last = payloads.at(-1);
    if (!last) return { raw: text };
    return JSON.parse(last) as Record<string, unknown>;
  }
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

async function rpc(
  claims: McpAccessTokenClaims,
  method: string,
  params: Record<string, unknown> = {},
  id: number = 1
): Promise<{
  status: number;
  body: Record<string, unknown>;
  headers: Headers;
}> {
  const request = new Request("http://127.0.0.1/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const response = await handleMcpWithClaims(request, claims);
  const body = await parseMcpResponse(response);
  return { status: response.status, body, headers: response.headers };
}

function toolNames(body: Record<string, unknown>): string[] {
  const result = body.result as { tools?: { name: string }[] } | undefined;
  return (result?.tools ?? []).map((tool) => tool.name).sort();
}

function toolPayload(body: Record<string, unknown>): Record<string, unknown> {
  const result = body.result as {
    content?: { type: string; text?: string }[];
  };
  const text = result?.content?.find((part) => part.type === "text")?.text;
  expect(text).toBeTruthy();
  return JSON.parse(text!) as Record<string, unknown>;
}

describe("MCP endpoint", () => {
  afterAll(async () => {
    await db.delete(appSettings).where(eq(appSettings.key, MCP_SETTINGS_KEY));
  });

  it("unauthenticated POST returns 401 with RFC 9728 WWW-Authenticate", async () => {
    const response = await mcpPost(
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      })
    );
    expect(response.status).toBe(401);
    const challenge = response.headers.get("www-authenticate");
    expect(challenge).toBeTruthy();
    expect(challenge?.toLowerCase()).toContain("bearer");
    expect(challenge).toMatch(/resource_metadata|error=/i);
  });

  it("expired token is rejected with 401 WWW-Authenticate", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const response = await handleMcpWithClaims(
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/list",
          params: {},
        }),
      }),
      claimsFor(pcm, ["profile:read", "read:pursuits"], {
        exp: Math.floor(Date.now() / 1000) - 60,
      })
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")?.toLowerCase()).toContain(
      "bearer"
    );
  });

  it("negotiates the legacy stateless protocol during initialize", async () => {
    const [appUser] = await db.select().from(users).limit(1);
    const response = await rpc(
      claimsFor(appUser, ["profile:read"]),
      "initialize",
      {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      }
    );
    expect(response.status).toBe(200);
    expect(
      (response.body.result as { protocolVersion?: string })?.protocolVersion
    ).toBeTruthy();
  });

  it("tools/list is filtered by effective scopes: profile-only sees whoami; read-only sees no write tools", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);

    const profileOnly = await rpc(
      claimsFor(pcm, ["profile:read"]),
      "tools/list"
    );
    expect(profileOnly.status).toBe(200);
    expect(toolNames(profileOnly.body)).toEqual(["whoami"]);

    const readOnly = await rpc(
      claimsFor(pcm, [
        "profile:read",
        "read:pursuits",
        "read:reports",
        "read:dashboards",
        "read:sheets",
      ]),
      "tools/list"
    );
    const names = toolNames(readOnly.body);
    expect(names).toContain("whoami");
    expect(names).toContain("query_efforts");
    expect(names).toContain("plan_chart");
    expect(names).not.toContain("append_note");
    expect(names).not.toContain("update_pursuit_fields");
  });

  it("whoami tools/call returns identity and effective scopes", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const listed = await rpc(claimsFor(pcm, ["profile:read"]), "tools/list");
    expect(toolNames(listed.body)).toEqual(["whoami"]);

    const called = await rpc(claimsFor(pcm, ["profile:read"]), "tools/call", {
      name: "whoami",
      arguments: {},
    });
    expect(called.status).toBe(200);
    const payload = toolPayload(called.body);
    expect(payload).toMatchObject({
      user: { email: pcm.email, role: "pcm" },
      effectiveScopes: ["profile:read"],
    });
  });

  it("query_efforts for a region-limited user returns zero rows from other regions", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.role, "corporate_admin"))
      .limit(1);
    const scopes = ["profile:read", "read:pursuits"];

    const adminCall = await rpc(claimsFor(admin, scopes), "tools/call", {
      name: "query_efforts",
      arguments: {},
    });
    const adminPayload = toolPayload(adminCall.body);
    const adminEfforts = adminPayload.efforts as {
      roundId: number;
      homeRegion: string;
    }[];
    const foreign = adminEfforts.filter((row) => row.homeRegion !== pcm.region);
    expect(foreign.length).toBeGreaterThan(0);

    const pcmCall = await rpc(claimsFor(pcm, scopes), "tools/call", {
      name: "query_efforts",
      arguments: {},
    });
    const pcmPayload = toolPayload(pcmCall.body);
    const pcmEfforts = pcmPayload.efforts as {
      roundId: number;
      homeRegion: string;
    }[];
    expect(pcmEfforts.length).toBeGreaterThan(0);
    const pcmIds = new Set(pcmEfforts.map((row) => row.roundId));
    for (const row of foreign) {
      expect(pcmIds.has(row.roundId)).toBe(false);
    }
  });

  it("ceiling revocation (kill switch) denies the next request without token reissue", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const granted = claimsFor(pcm, ["profile:read", "read:pursuits"]);

    const before = await rpc(granted, "tools/list");
    expect(before.status).toBe(200);
    expect(toolNames(before.body).length).toBeGreaterThan(0);

    await db
      .insert(appSettings)
      .values({ key: MCP_SETTINGS_KEY, value: { enabled: false } })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: { enabled: false } },
      });

    const after = await rpc(granted, "tools/list");
    expect(after.status).toBe(403);
    expect(JSON.stringify(after.body)).toMatch(/disabled/i);

    await db.delete(appSettings).where(eq(appSettings.key, MCP_SETTINGS_KEY));
  });

  it("malformed JSON-RPC body does not 500", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const response = await handleMcpWithClaims(
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: "not-json{",
      }),
      claimsFor(pcm, ["profile:read"])
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  it("authenticated token whose email has no app users row returns 403", async () => {
    const response = await rpc(
      {
        sub: "ba-unknown",
        email: "not-on-roster@example.com",
        scope: "profile:read read:pursuits",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "tools/list"
    );
    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).toMatch(/roster/i);
  });

  it("resolves an email-less access token through its Better Auth subject", async () => {
    const [appUser] = await db.select().from(users).limit(1);
    const subject = `mcp-subject-${appUser.id}`;
    await db.insert(authUser).values({
      id: subject,
      name: appUser.name,
      email: appUser.email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    try {
      const response = await rpc(
        {
          sub: subject,
          scope: "profile:read",
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        "tools/list"
      );
      expect(response.status).toBe(200);
      expect(toolNames(response.body)).toEqual(["whoami"]);
    } finally {
      await db.delete(authUser).where(eq(authUser.id, subject));
    }
  });
});

const WRITE_SCOPES = [
  "profile:read",
  "read:pursuits",
  "write:pursuits",
  "read:reports",
  "read:dashboards",
  "read:sheets",
];

async function grantWriteCeiling(userId: number) {
  await db
    .insert(mcpUserAccess)
    .values({
      userId,
      enabled: true,
      scopeCeiling: WRITE_SCOPES,
    })
    .onConflictDoUpdate({
      target: mcpUserAccess.userId,
      set: { enabled: true, scopeCeiling: WRITE_SCOPES, updatedAt: new Date() },
    });
}

describe("MCP write tools", () => {
  afterAll(async () => {
    await db.delete(mcpUserAccess);
    await db.delete(appSettings).where(eq(appSettings.key, MCP_SETTINGS_KEY));
  });

  it("default-configuration user gets scope-denied JSON-RPC error on both write tools", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const granted = claimsFor(pcm, WRITE_SCOPES);

    const listed = await rpc(granted, "tools/list");
    expect(toolNames(listed.body)).not.toContain("append_note");
    expect(toolNames(listed.body)).not.toContain("update_pursuit_fields");

    const note = await rpc(granted, "tools/call", {
      name: "append_note",
      arguments: { roundId: 1, body: "should not write" },
    });
    expect(note.status).toBe(403);
    expect(JSON.stringify(note.body)).toMatch(/write:pursuits/);

    const fields = await rpc(granted, "tools/call", {
      name: "update_pursuit_fields",
      arguments: { roundId: 1, fields: { owner: "Nope" } },
    });
    expect(fields.status).toBe(403);
    expect(JSON.stringify(fields.body)).toMatch(/write:pursuits/);
  });

  it("with write ceiling + consent, append_note creates a note visible via search_notes", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    await grantWriteCeiling(pcm.id);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(
        and(
          eq(jobs.region, pcm.region ?? "Central"),
          isNull(estimateRounds.deletedAt),
          ne(estimateRounds.status, "locked")
        )
      )
      .limit(1);
    expect(round).toBeTruthy();
    const marker = `mcp-note-${Date.now()}`;
    const called = await rpc(claimsFor(pcm, WRITE_SCOPES), "tools/call", {
      name: "append_note",
      arguments: { roundId: round.id, body: marker },
    });
    expect(called.status).toBe(200);
    const created = toolPayload(called.body);
    expect(created.noteId).toBeTruthy();

    const search = await rpc(claimsFor(pcm, WRITE_SCOPES), "tools/call", {
      name: "search_notes",
      arguments: { query: marker },
    });
    const found = toolPayload(search.body);
    const notes = found.notes as { excerpt: string }[];
    expect(notes.some((note) => note.excerpt.includes(marker))).toBe(true);

    await db
      .delete(roundNotes)
      .where(eq(roundNotes.id, Number(created.noteId)));
    await db.delete(mcpUserAccess).where(eq(mcpUserAccess.userId, pcm.id));
  });

  it("update_pursuit_fields rejects fields outside the allowlist and succeeds on allowed fields", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    await grantWriteCeiling(pcm.id);
    const [round] = await db
      .select({ id: estimateRounds.id, owner: estimateRounds.owner })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(
        and(
          eq(jobs.region, pcm.region ?? "Central"),
          isNull(estimateRounds.deletedAt),
          ne(estimateRounds.status, "locked")
        )
      )
      .limit(1);
    expect(round).toBeTruthy();

    const blocked = await rpc(claimsFor(pcm, WRITE_SCOPES), "tools/call", {
      name: "update_pursuit_fields",
      arguments: {
        roundId: round.id,
        fields: { region: "West", status: "locked" },
      },
    });
    expect(blocked.status).toBe(200);
    const blockedPayload = toolPayload(blocked.body);
    expect(String(blockedPayload.error)).toMatch(/not allowed over MCP/i);

    const nextOwner = `MCP Owner ${Date.now()}`;
    const ok = await rpc(claimsFor(pcm, WRITE_SCOPES), "tools/call", {
      name: "update_pursuit_fields",
      arguments: { roundId: round.id, fields: { owner: nextOwner } },
    });
    expect(ok.status).toBe(200);
    const okPayload = toolPayload(ok.body);
    expect(okPayload.error).toBeUndefined();
    expect(okPayload.changed).toBeGreaterThan(0);

    const [updated] = await db
      .select({ owner: estimateRounds.owner })
      .from(estimateRounds)
      .where(eq(estimateRounds.id, round.id));
    expect(updated.owner).toBe(nextOwner);

    await db
      .update(estimateRounds)
      .set({ owner: round.owner })
      .where(eq(estimateRounds.id, round.id));
    await db.delete(mcpUserAccess).where(eq(mcpUserAccess.userId, pcm.id));
  });

  it("leadership role with write scopes granted is still denied by the kernel", async () => {
    const [lead] = await db
      .select()
      .from(users)
      .where(eq(users.role, "leadership"))
      .limit(1);
    await grantWriteCeiling(lead.id);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .where(eq(estimateRounds.status, "active"))
      .limit(1);

    const listed = await rpc(claimsFor(lead, WRITE_SCOPES), "tools/list");
    expect(toolNames(listed.body)).toContain("update_pursuit_fields");

    const fields = await rpc(claimsFor(lead, WRITE_SCOPES), "tools/call", {
      name: "update_pursuit_fields",
      arguments: { roundId: round.id, fields: { owner: "Nope" } },
    });
    const fieldPayload = toolPayload(fields.body);
    expect(String(fieldPayload.error)).toMatch(/not permitted|not found/i);

    await db.delete(mcpUserAccess).where(eq(mcpUserAccess.userId, lead.id));
  });

  it("locked round update is denied", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    await grantWriteCeiling(pcm.id);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(
        and(
          eq(jobs.region, pcm.region ?? "Central"),
          eq(estimateRounds.status, "locked")
        )
      )
      .limit(1);
    expect(round).toBeTruthy();

    const called = await rpc(claimsFor(pcm, WRITE_SCOPES), "tools/call", {
      name: "update_pursuit_fields",
      arguments: { roundId: round.id, fields: { owner: "Locked" } },
    });
    const payload = toolPayload(called.body);
    expect(String(payload.error)).toMatch(/locked/i);

    await db.delete(mcpUserAccess).where(eq(mcpUserAccess.userId, pcm.id));
  });

  it("oversized JSON-RPC body is rejected without a 500", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const response = await handleMcpWithClaims(
      new Request("http://127.0.0.1/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Content-Length": String(MAX_MCP_BODY_BYTES + 1),
        },
        body: "{}",
      }),
      claimsFor(pcm, ["profile:read"])
    );
    expect(response.status).toBe(413);
    expect(JSON.stringify(await parseMcpResponse(response))).toMatch(
      /too large/i
    );
  });

  it("region-less user still receives query_efforts rows", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const original = pcm.region;
    await db.update(users).set({ region: null }).where(eq(users.id, pcm.id));
    try {
      const listed = await rpc(claimsFor(pcm, WRITE_SCOPES), "tools/call", {
        name: "query_efforts",
        arguments: {},
      });
      expect(listed.status).toBe(200);
      const payload = toolPayload(listed.body);
      expect(Number(payload.count)).toBeGreaterThan(0);
    } finally {
      await db
        .update(users)
        .set({ region: original })
        .where(eq(users.id, pcm.id));
    }
  });

  it("role change after consent re-evaluates the kernel on the next request", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const originalRole = pcm.role;
    await grantWriteCeiling(pcm.id);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(
        and(
          eq(jobs.region, pcm.region ?? "Central"),
          ne(estimateRounds.status, "locked")
        )
      )
      .limit(1);
    expect(round).toBeTruthy();
    await db
      .update(users)
      .set({ role: "leadership" })
      .where(eq(users.id, pcm.id));
    try {
      const called = await rpc(claimsFor(pcm, WRITE_SCOPES), "tools/call", {
        name: "update_pursuit_fields",
        arguments: { roundId: round.id, fields: { owner: "Nope" } },
      });
      const payload = toolPayload(called.body);
      expect(String(payload.error)).toMatch(/not permitted|not found/i);
    } finally {
      await db
        .update(users)
        .set({ role: originalRole })
        .where(eq(users.id, pcm.id));
      await db.delete(mcpUserAccess).where(eq(mcpUserAccess.userId, pcm.id));
    }
  });
});
