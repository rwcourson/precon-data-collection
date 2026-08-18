import "server-only";
import { eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { salesforceJobs } from "@/db/schema";
import { getRuntimeConfig } from "@/lib/runtime-config";

/**
 * B&G Connect / Salesforce lookup (BRD Section 5). The Databricks probe found no
 * Connect pursuit tables in Unity Catalog, so the prototype keeps a seeded
 * mirror table. This module is the single seam the rest of the app talks to:
 * pointing `CONNECT_MODE=rest` at a real endpoint swaps the source without
 * touching the pursuit actions or the match-and-merge UI.
 */

export type ConnectJob = {
  sfId: string;
  jobNumber: string;
  jobName: string;
  region: string;
  marketSector: string | null;
  city: string | null;
  state: string | null;
  /** Opportunity creation date, where the source exposes one. */
  createdDate?: string | null;
};

export type ConnectMode = "disabled" | "mock" | "rest";

export function connectMode(): ConnectMode {
  return getRuntimeConfig().integrations.connect;
}

export type ConnectProvider = {
  mode: ConnectMode;
  search(query: string): Promise<ConnectJob[]>;
  getById(sfId: string): Promise<ConnectJob | null>;
  /** Everything available for scoring candidate matches against a manual job. */
  list(): Promise<ConnectJob[]>;
};

const mockProvider: ConnectProvider = {
  mode: "mock",
  async search(query) {
    const q = `%${query.trim()}%`;
    return db
      .select()
      .from(salesforceJobs)
      .where(
        or(ilike(salesforceJobs.jobName, q), ilike(salesforceJobs.jobNumber, q))
      )
      .limit(8);
  },
  async getById(sfId) {
    const [row] = await db
      .select()
      .from(salesforceJobs)
      .where(eq(salesforceJobs.sfId, sfId));
    return row ?? null;
  },
  async list() {
    return db.select().from(salesforceJobs);
  },
};

/**
 * Talks to whatever REST facade B&G exposes over Connect. Field names are
 * normalised here so a schema difference on their side stays contained.
 */
function restProvider(baseUrl: string, token: string): ConnectProvider {
  const call = async (path: string, params: Record<string, string> = {}) => {
    const url = new URL(
      path.replace(/^\//, ""),
      baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
    );
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      // Pursuit lookups are interactive; a stale answer is worse than a slow one.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`B&G Connect responded ${res.status}`);
    return (await res.json()) as unknown;
  };

  const normalise = (raw: unknown): ConnectJob | null => {
    const r = raw as Record<string, unknown>;
    const sfId = str(r.sfId ?? r.id ?? r.Id);
    const jobNumber = str(r.jobNumber ?? r.JobNumber ?? r.job_number);
    const jobName = str(r.jobName ?? r.Name ?? r.job_name);
    if (!sfId || !jobNumber || !jobName) return null;
    return {
      sfId,
      jobNumber,
      jobName,
      region: str(r.region ?? r.Region) ?? "",
      marketSector: str(r.marketSector ?? r.MarketSector),
      city: str(r.city ?? r.City),
      state: str(r.state ?? r.State),
      createdDate: str(r.createdDate ?? r.CreatedDate),
    };
  };

  const many = (payload: unknown): ConnectJob[] => {
    const rows = Array.isArray(payload)
      ? payload
      : ((payload as { records?: unknown[] })?.records ?? []);
    return rows.map(normalise).filter((j): j is ConnectJob => j != null);
  };

  return {
    mode: "rest",
    async search(query) {
      return many(await call("jobs", { q: query.trim(), limit: "8" }));
    },
    async getById(sfId) {
      return normalise(await call(`jobs/${encodeURIComponent(sfId)}`));
    },
    async list() {
      return many(await call("jobs", { limit: "500" }));
    },
  };
}

const str = (v: unknown): string | null => {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
};

export function connectProvider(): ConnectProvider {
  const mode = connectMode();
  if (mode === "mock") return mockProvider;
  if (mode === "rest") {
    return restProvider(
      process.env.CONNECT_API_URL!,
      process.env.CONNECT_API_TOKEN!
    );
  }
  throw new Error("B&G Connect is disabled for this deployment.");
}
