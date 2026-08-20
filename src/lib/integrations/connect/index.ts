import "server-only";
import { eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { salesforceJobs } from "@/db/schema";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { wrapConnectLookups } from "./fallback";
import {
  type ConnectJob,
  normaliseConnectJob,
  normaliseConnectJobs,
} from "./normalize";

export type { ConnectJob };

/**
 * B&G Connect / Salesforce lookup (BRD Section 5). The Databricks probe found no
 * Connect pursuit tables in Unity Catalog, so the prototype keeps a seeded
 * mirror table. This module is the single seam the rest of the app talks to:
 * pointing `CONNECT_MODE=rest` at a real endpoint swaps the source without
 * touching the pursuit actions or the match-and-merge UI.
 */

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
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`B&G Connect responded ${res.status}`);
    return (await res.json()) as unknown;
  };

  return {
    mode: "rest",
    async search(query) {
      const payload = await call("jobs", { q: query.trim(), limit: "8" });
      return payload == null ? [] : normaliseConnectJobs(payload);
    },
    async getById(sfId) {
      const payload = await call(`jobs/${encodeURIComponent(sfId)}`);
      return payload == null ? null : normaliseConnectJob(payload);
    },
    async list() {
      const payload = await call("jobs", { limit: "500" });
      return payload == null ? [] : normaliseConnectJobs(payload);
    },
  };
}

export function connectProvider(): ConnectProvider {
  const mode = connectMode();
  if (mode === "mock") return mockProvider;
  if (mode === "rest") {
    const rest = restProvider(
      process.env.CONNECT_API_URL!,
      process.env.CONNECT_API_TOKEN!
    );
    return {
      mode: "rest",
      ...wrapConnectLookups(rest, mockProvider),
    };
  }
  throw new Error("B&G Connect is disabled for this deployment.");
}
