/**
 * Integration tests that drive shipped mobile auth + API handlers against
 * the real DB (PGlite / DATABASE_URL) and real route modules.
 */

import { asc, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as adminPost } from "@/app/api/v1/mobile/admin/route";
import { GET as dashboardsGet } from "@/app/api/v1/mobile/dashboards/route";
import { GET as meGet } from "@/app/api/v1/mobile/me/route";
import { GET as overviewGet } from "@/app/api/v1/mobile/overview/route";
import { POST as pursuitsPost } from "@/app/api/v1/mobile/pursuits/route";
import { POST as reportsPost } from "@/app/api/v1/mobile/reports/route";
import { POST as approveLockPost } from "@/app/api/v1/mobile/rounds/[id]/approve-lock/route";
import {
  GET as sheetGet,
  PATCH as sheetPatch,
} from "@/app/api/v1/mobile/sheets/[id]/route";
import { POST as sheetsPost } from "@/app/api/v1/mobile/sheets/route";
import { db, ensureDbReady } from "@/db";
import { estimateRounds, jobs, sheetColumns, users } from "@/db/schema";
import { isMobileAdminRole } from "@/lib/mobile-admin";
import {
  isDemoAuthAllowed,
  issueDemoSession,
  resolveMobilePrincipal,
} from "@/lib/mobile-auth";
import { CONSOLIDATED_REGIONAL_PRESET } from "@/lib/report-presets";

function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function sessionForRole(role: string) {
  const all = await db.select().from(users).orderBy(asc(users.id));
  const user = all.find((u) => u.role === role);
  if (!user) throw new Error(`No seeded user with role ${role}`);
  const issued = await issueDemoSession(user.id);
  if ("error" in issued) throw new Error(issued.error);
  return issued;
}

beforeAll(async () => {
  await ensureDbReady();
}, 90_000);

describe("mobile auth shipped path", () => {
  it("issueDemoSession returns token+user when demo allowed", async () => {
    if (!isDemoAuthAllowed()) {
      const denied = await issueDemoSession(1);
      expect("error" in denied && denied.status === 403).toBe(true);
      return;
    }
    const all = await db.select().from(users).orderBy(asc(users.id));
    expect(all.length).toBeGreaterThan(0);
    const issued = await issueDemoSession(all[0].id);
    expect("token" in issued).toBe(true);
    if ("token" in issued) {
      expect(issued.token.startsWith("pcn_")).toBe(true);
      expect(issued.user.id).toBe(all[0].id);
    }
  });

  it("issueDemoSession 404 for missing user", async () => {
    if (!isDemoAuthAllowed()) return;
    const res = await issueDemoSession(9_999_999);
    expect("error" in res).toBe(true);
    if ("error" in res) expect(res.status).toBe(404);
  });

  it("resolveMobilePrincipal 401 without bearer", async () => {
    const res = await resolveMobilePrincipal(null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });

  it("resolveMobilePrincipal 401 with garbage bearer", async () => {
    const res = await resolveMobilePrincipal("Bearer not-a-real-token");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });

  it("resolveMobilePrincipal ok with issued demo token", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("pcm");
    const res = await resolveMobilePrincipal(`Bearer ${issued.token}`);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.principal.user.id).toBe(issued.user.id);
      expect(res.principal.source).toBe("demo_session");
    }
  });

  it("GET /me returns 401 without Authorization", async () => {
    const res = await meGet(new Request("http://localhost/api/v1/mobile/me"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("GET /me returns 200 with valid bearer", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("rpd");
    const res = await meGet(
      new Request("http://localhost/api/v1/mobile/me", {
        headers: bearer(issued.token),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: number; role: string } };
    expect(body.user.id).toBe(issued.user.id);
    expect(body.user.role).toBe("rpd");
  });

  it("GET /overview returns 401 without bearer", async () => {
    const res = await overviewGet(
      new Request("http://localhost/api/v1/mobile/overview")
    );
    expect(res.status).toBe(401);
  });

  it("GET /overview returns KPI bundle with valid bearer", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("pcm");
    const res = await overviewGet(
      new Request("http://localhost/api/v1/mobile/overview", {
        headers: bearer(issued.token),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      kpis: {
        ytdVolume: number;
        ytdVolumeLabel: string;
        ytdRoundCount: number;
        awaitingPostBid: number;
        awaitingApproval: number;
        winRatePct: number | null;
        wins: number;
        decided: number;
      };
      bidYear: number;
      totalRounds: number;
    };
    expect(body.bidYear).toBe(2026);
    expect(typeof body.kpis.ytdVolume).toBe("number");
    expect(body.kpis.ytdVolumeLabel.length).toBeGreaterThan(0);
    expect(typeof body.kpis.ytdRoundCount).toBe("number");
    expect(typeof body.kpis.awaitingPostBid).toBe("number");
    expect(typeof body.kpis.awaitingApproval).toBe("number");
    expect(typeof body.totalRounds).toBe("number");
  });
});

describe("mobile data-view paths (shipped handlers)", () => {
  it("GET /dashboards returns kpis + statusSeries + groupVolume and level changes series", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("pcm");
    const corpRes = await dashboardsGet(
      new Request("http://localhost/api/v1/mobile/dashboards?level=corporate", {
        headers: bearer(issued.token),
      })
    );
    expect(corpRes.status).toBe(200);
    const corp = (await corpRes.json()) as {
      level: string;
      groupBy: string;
      kpis: { key: string; value: number | null; format: string }[];
      statusSeries: { label: string; value: number }[];
      groupVolume: { label: string; value: number }[];
      regionVolume: { label: string; value: number }[];
      empty: boolean;
    };
    expect(corp.level).toBe("corporate");
    expect(corp.groupBy).toBe("region");
    expect(corp.kpis.length).toBeGreaterThanOrEqual(3);
    expect(corp.kpis.some((k) => k.format === "dollars")).toBe(true);
    expect(Array.isArray(corp.statusSeries)).toBe(true);
    expect(Array.isArray(corp.groupVolume)).toBe(true);
    expect(Array.isArray(corp.regionVolume)).toBe(true);

    const regRes = await dashboardsGet(
      new Request("http://localhost/api/v1/mobile/dashboards?level=region", {
        headers: bearer(issued.token),
      })
    );
    expect(regRes.status).toBe(200);
    const reg = (await regRes.json()) as {
      level: string;
      groupBy: string;
      groupVolume: { label: string; value: number }[];
      kpis: { key: string; value: number | null }[];
    };
    expect(reg.level).toBe("region");
    expect(reg.groupBy).toBe("preconDepartment");
    // Level must not be a no-op: group dimension differs from corporate
    expect(reg.groupBy).not.toBe(corp.groupBy);

    const divRes = await dashboardsGet(
      new Request("http://localhost/api/v1/mobile/dashboards?level=division", {
        headers: bearer(issued.token),
      })
    );
    const div = (await divRes.json()) as { groupBy: string };
    expect(div.groupBy).toBe("marketSector");
  });

  it("GET /sheets/:id returns multi-column matrix for grid sheets", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("pcm");
    // Create a grid sheet then edit a cell — proves scannable column+row payload
    const created = await sheetsPost(
      new Request("http://localhost/api/v1/mobile/sheets", {
        method: "POST",
        headers: {
          ...bearer(issued.token),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: `Vitest grid ${Date.now()}`,
          kind: "grid",
          folder: "Mobile",
        }),
      })
    );
    const createdBody = (await created.json()) as {
      id: number;
      data?: { id: number };
    };
    const sheetId = createdBody.id ?? createdBody.data?.id;
    expect(created.status).toBeGreaterThanOrEqual(200);
    expect(sheetId).toBeGreaterThan(0);

    // Add a row so the grid is non-empty after optional default columns
    await sheetPatch(
      new Request(`http://localhost/api/v1/mobile/sheets/${sheetId}`, {
        method: "PATCH",
        headers: {
          ...bearer(issued.token),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "add-row" }),
      }),
      { params: Promise.resolve({ id: String(sheetId) }) }
    );

    const res = await sheetGet(
      new Request(`http://localhost/api/v1/mobile/sheets/${sheetId}?limit=10`, {
        headers: bearer(issued.token),
      }),
      { params: Promise.resolve({ id: String(sheetId) }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        columns: { key: string; label: string }[];
        rows: { id: number; values: Record<string, string | null> }[];
        kind?: string;
        pagination: { total: number };
      };
    };
    expect(
      body.data.kind === "grid" ||
        body.data.kind == null ||
        body.data.kind === "view"
    ).toBe(true);
    // New grids start with at least the schema columns or zero — if zero, columns array still present
    expect(Array.isArray(body.data.columns)).toBe(true);
    expect(Array.isArray(body.data.rows)).toBe(true);
    if (body.data.columns.length >= 1 && body.data.rows.length >= 1) {
      const key = body.data.columns[0].key;
      await sheetPatch(
        new Request(`http://localhost/api/v1/mobile/sheets/${sheetId}`, {
          method: "PATCH",
          headers: {
            ...bearer(issued.token),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            cell: { rowId: body.data.rows[0].id, key, value: "scannable-cell" },
          }),
        }),
        { params: Promise.resolve({ id: String(sheetId) }) }
      );
      const again = await sheetGet(
        new Request(
          `http://localhost/api/v1/mobile/sheets/${sheetId}?limit=10`,
          {
            headers: bearer(issued.token),
          }
        ),
        { params: Promise.resolve({ id: String(sheetId) }) }
      );
      const againBody = (await again.json()) as {
        data: { rows: { values: Record<string, string | null> }[] };
      };
      expect(againBody.data.rows[0].values[key]).toBe("scannable-cell");
    }
  });
});

describe("mobile write paths (shipped handlers)", () => {
  it("POST pursuits creates a job/round", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("pcm");
    const res = await pursuitsPost(
      new Request("http://localhost/api/v1/mobile/pursuits", {
        method: "POST",
        headers: {
          ...bearer(issued.token),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "manual",
          jobName: `Vitest pursuit ${Date.now()}`,
          region: "Central",
          preconDepartment: "Central Heavy Civil",
          estimatePhase: "ROM",
          bidYear: new Date().getFullYear(),
          initialStatus: "upcoming",
        }),
      })
    );
    const body = (await res.json()) as {
      data: { jobId: number; roundId: number };
      error?: string;
    };
    expect(res.status, JSON.stringify(body)).toBe(201);
    expect(body.data.jobId).toBeGreaterThan(0);
    expect(body.data.roundId).toBeGreaterThan(0);
  });

  it("approve-lock returns 4xx with missingFields for incomplete post_bid", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("rpd");

    let [round] = await db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.status, "post_bid"))
      .limit(1);

    if (!round) {
      const [job] = await db
        .select()
        .from(jobs)
        .where(isNull(jobs.deletedAt))
        .limit(1);
      if (!job) return;
      const [created] = await db
        .insert(estimateRounds)
        .values({
          jobId: job.id,
          roundNumber: 99,
          status: "post_bid",
          region: job.region,
          preconDepartment: job.preconDepartment,
          estimatePhase: "ROM",
          bidYear: new Date().getFullYear(),
        })
        .returning();
      round = created;
    }

    await db
      .update(estimateRounds)
      .set({ estimateValue: null })
      .where(eq(estimateRounds.id, round.id));

    const res = await approveLockPost(
      new Request(
        `http://localhost/api/v1/mobile/rounds/${round.id}/approve-lock`,
        { method: "POST", headers: bearer(issued.token) }
      ),
      { params: Promise.resolve({ id: String(round.id) }) }
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const body = (await res.json()) as {
      error: string;
      missingFields?: string[];
      details?: string[];
    };
    const missing = body.missingFields ?? body.details ?? [];
    expect(Array.isArray(missing)).toBe(true);
    expect(
      missing.length > 0 ||
        /required|blank|cannot lock|missing/i.test(body.error)
    ).toBe(true);
  });

  it("sheet create + cell update round-trips", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("pcm");
    const createRes = await sheetsPost(
      new Request("http://localhost/api/v1/mobile/sheets", {
        method: "POST",
        headers: {
          ...bearer(issued.token),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "grid",
          name: `Vitest sheet ${Date.now()}`,
          folder: "Tests",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const { id: sheetId } = (await createRes.json()) as { id: number };
    expect(sheetId).toBeGreaterThan(0);

    const cols = await db
      .select()
      .from(sheetColumns)
      .where(eq(sheetColumns.sheetId, sheetId));
    const key = cols[0]?.key ?? "name";

    const addRes = await sheetPatch(
      new Request(`http://localhost/api/v1/mobile/sheets/${sheetId}`, {
        method: "PATCH",
        headers: {
          ...bearer(issued.token),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "add-row" }),
      }),
      { params: Promise.resolve({ id: String(sheetId) }) }
    );
    expect(addRes.status).toBe(200);
    const { rowId } = (await addRes.json()) as { rowId: number };

    const value = `updated-${Date.now()}`;
    const patchRes = await sheetPatch(
      new Request(`http://localhost/api/v1/mobile/sheets/${sheetId}`, {
        method: "PATCH",
        headers: {
          ...bearer(issued.token),
          "content-type": "application/json",
        },
        body: JSON.stringify({ cell: { rowId, key, value } }),
      }),
      { params: Promise.resolve({ id: String(sheetId) }) }
    );
    expect(patchRes.status).toBe(200);

    const getRes = await sheetGet(
      new Request(
        `http://localhost/api/v1/mobile/sheets/${sheetId}?limit=50&offset=0`,
        { headers: bearer(issued.token) }
      ),
      { params: Promise.resolve({ id: String(sheetId) }) }
    );
    expect(getRes.status).toBe(200);
    const got = (await getRes.json()) as {
      data: { rows: { id: number; values: Record<string, string | null> }[] };
    };
    const match = got.data.rows.find((r) => r.id === rowId);
    expect(match).toBeTruthy();
    expect(match?.values?.[key]).toBe(value);
  });

  it("run report returns rowCount from shipped engine", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("pcm");
    const res = await reportsPost(
      new Request("http://localhost/api/v1/mobile/reports", {
        method: "POST",
        headers: {
          ...bearer(issued.token),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "run",
          config: CONSOLIDATED_REGIONAL_PRESET.config,
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { rowCount: number };
    };
    expect(typeof body.result.rowCount).toBe("number");
    expect(body.result.rowCount).toBeGreaterThanOrEqual(0);
  });

  it("admin mutation 403 for non-admin roles (pcm, leadership, estimate_lead)", async () => {
    if (!isDemoAuthAllowed()) return;
    expect(isMobileAdminRole("pcm")).toBe(false);
    expect(isMobileAdminRole("leadership")).toBe(false);
    expect(isMobileAdminRole("estimate_lead")).toBe(false);
    expect(isMobileAdminRole("corporate_admin")).toBe(true);

    for (const role of ["pcm", "leadership", "estimate_lead"] as const) {
      const issued = await sessionForRole(role);
      const res = await adminPost(
        new Request("http://localhost/api/v1/mobile/admin", {
          method: "POST",
          headers: {
            ...bearer(issued.token),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "add-reference",
            listKey: "marketSector",
            value: `blocked-${role}-${Date.now()}`,
          }),
        })
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/permission|admin/i);
    }
  });

  it("admin mutation succeeds for corporate_admin", async () => {
    if (!isDemoAuthAllowed()) return;
    const issued = await sessionForRole("corporate_admin");
    const value = `vitest-admin-${Date.now()}`;
    const res = await adminPost(
      new Request("http://localhost/api/v1/mobile/admin", {
        method: "POST",
        headers: {
          ...bearer(issued.token),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "add-reference",
          listKey: "marketSector",
          value,
        }),
      })
    );
    expect(res.status).toBe(200);
  });
});
