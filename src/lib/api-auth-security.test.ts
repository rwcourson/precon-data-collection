import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { switchUser } from "@/actions/user";
import { db } from "@/db";
import { apiTokens, users } from "@/db/schema";
import { authenticateBearer } from "@/lib/api-auth";
import { generateApiTokenSecret, hashToken } from "@/lib/api-tokens";
import { revokeDemoSessionTokens } from "@/lib/demo-token-revocation";
import { issueDemoSession, resolveMobilePrincipal } from "@/lib/mobile-auth";
import { jsonOk, withMobileAuth } from "@/lib/mobile-http";

afterEach(() => vi.unstubAllEnvs());

describe("bearer token security", () => {
  it("updates last-used safely and observes revocation immediately", async () => {
    const [owner] = await db.select().from(users).limit(1);
    const secret = generateApiTokenSecret();
    const [token] = await db
      .insert(apiTokens)
      .values({
        name: "phase4-immediate-revoke",
        tokenHash: secret.hash,
        tokenPrefix: secret.prefix,
        scopes: ["read:pursuits"],
        regionAllowlist: ["Central"],
        createdById: owner.id,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning();
    try {
      const valid = await authenticateBearer(`Bearer ${secret.plaintext}`);
      expect(valid.ok).toBe(true);
      const [used] = await db
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.id, token.id));
      expect(used.lastUsedAt).not.toBeNull();
      await db
        .update(apiTokens)
        .set({ revokedAt: new Date() })
        .where(eq(apiTokens.id, token.id));
      expect((await authenticateBearer(`Bearer ${secret.plaintext}`)).ok).toBe(
        false
      );
    } finally {
      await db.delete(apiTokens).where(eq(apiTokens.id, token.id));
    }
  });

  it("requires the route's declared scope and intersects token/workspace Regions", async () => {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.role, "corporate_admin"));
    const secret = generateApiTokenSecret();
    const [token] = await db
      .insert(apiTokens)
      .values({
        name: "phase4-scope-region",
        tokenHash: secret.hash,
        tokenPrefix: secret.prefix,
        scopes: ["read:pursuits"],
        regionAllowlist: ["Florida"],
        createdById: owner.id,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning();
    try {
      const req = new Request("http://localhost/api/v1/mobile/test", {
        headers: {
          authorization: `Bearer ${secret.plaintext}`,
          "x-workspace-region": "Central",
        },
      });
      const allowed = await withMobileAuth(
        req,
        { scopes: "read:pursuits" },
        async (principal) =>
          jsonOk({ regions: principal.authorization.allowedRegions })
      );
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toEqual({ regions: [] });

      const denied = await withMobileAuth(
        req,
        { scopes: "write:pursuits" },
        async () => jsonOk({ unexpected: true })
      );
      expect(denied.status).toBe(403);
    } finally {
      await db.delete(apiTokens).where(eq(apiTokens.id, token.id));
    }
  });

  it("rejects an existing demo-session token whenever demo mode is disabled", async () => {
    const [owner] = await db.select().from(users).where(eq(users.role, "pcm"));
    const issued = await issueDemoSession(owner.id);
    if ("error" in issued) throw new Error(issued.error);
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("AUTH_MODE", "sso");
    vi.stubEnv("SSO_ALLOWED_DOMAINS", "brasfieldgorrie.com");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-better-auth-secret-32chars!!");
    vi.stubEnv("MICROSOFT_CLIENT_ID", "test-client-id");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("MICROSOFT_TENANT_ID", "test-tenant-id");
    try {
      const result = await resolveMobilePrincipal(`Bearer ${issued.token}`);
      expect(result).toMatchObject({
        ok: false,
        status: 401,
        error: "Demo session is disabled",
      });
    } finally {
      await db
        .delete(apiTokens)
        .where(eq(apiTokens.tokenHash, hashToken(issued.token)));
    }
  });

  it("rejects persona switching whenever demo mode is disabled", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("AUTH_MODE", "sso");
    vi.stubEnv("SSO_ALLOWED_DOMAINS", "brasfieldgorrie.com");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-better-auth-secret-32chars!!");
    vi.stubEnv("MICROSOFT_CLIENT_ID", "test-client-id");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("MICROSOFT_TENANT_ID", "test-tenant-id");
    await expect(switchUser(1)).rejects.toThrow(/demo feature/i);
  });

  it("supports redacted dry-run/apply revocation without affecting other token names", async () => {
    const [owner] = await db.select().from(users).limit(1);
    const secret = generateApiTokenSecret();
    const [token] = await db
      .insert(apiTokens)
      .values({
        name: "phase4-demo-session:test",
        tokenHash: secret.hash,
        tokenPrefix: secret.prefix,
        scopes: ["profile:read"],
        regionAllowlist: [],
        createdById: owner.id,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning();
    try {
      expect(
        await revokeDemoSessionTokens({
          apply: false,
          namePrefix: "phase4-demo-session:",
        })
      ).toEqual({ mode: "dry-run", matched: 1 });
      expect(
        (await db.select().from(apiTokens).where(eq(apiTokens.id, token.id)))[0]
          .revokedAt
      ).toBeNull();
      expect(
        await revokeDemoSessionTokens({
          apply: true,
          namePrefix: "phase4-demo-session:",
        })
      ).toEqual({ mode: "apply", matched: 1 });
      expect(
        (await db.select().from(apiTokens).where(eq(apiTokens.id, token.id)))[0]
          .revokedAt
      ).not.toBeNull();
    } finally {
      await db.delete(apiTokens).where(eq(apiTokens.id, token.id));
    }
  });
});

describe("mobile route scope declaration boundary", () => {
  it("requires every bearer route to declare scopes before its handler", () => {
    const root = path.join(process.cwd(), "src/app/api/v1/mobile");
    const files: string[] = [];
    const visit = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (entry.name === "route.ts") files.push(absolute);
      }
    };
    visit(root);
    let calls = 0;
    let declarations = 0;
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      calls += source.match(/withMobileAuth\(/g)?.length ?? 0;
      declarations +=
        source.match(/withMobileAuth\(\s*req,\s*\{\s*scopes:/g)?.length ?? 0;
    }
    expect(calls).toBeGreaterThan(0);
    expect(declarations).toBe(calls);
  });
});
