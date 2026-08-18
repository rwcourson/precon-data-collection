import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import {
  GET as databricksGet,
  POST as databricksPost,
} from "@/app/api/jobs/databricks-sync/route";
import { POST as salesforcePost } from "@/app/api/jobs/salesforce-sync/route";
import { ensureDbReady } from "@/db";
import { createServicePrincipal } from "@/services/distribution-service";
import { salesforceSyncService } from "@/services/salesforce-sync-service";

beforeAll(async () => {
  await ensureDbReady();
  process.env.CRON_SECRET = "cron-test-secret-abcdefgh";
});

function cronReq(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: "Bearer cron-test-secret-abcdefgh",
    },
  });
}

describe("external sync jobs", () => {
  it("rejects unauthenticated cron salesforce sync", async () => {
    const res = await salesforcePost(
      new Request("http://localhost/api/jobs/salesforce-sync", {
        method: "POST",
      })
    );
    expect([401, 503]).toContain(res.status);
  });

  it("runs incremental salesforce sync idempotently without row previews", async () => {
    const principal = createServicePrincipal(null);
    const first = await salesforceSyncService.runIncremental(principal, {
      pageSize: 50,
    });
    expect(first).not.toHaveProperty("candidates");
    expect(first.opportunitiesSeen).toBeGreaterThanOrEqual(0);
    const second = await salesforceSyncService.runIncremental(principal, {
      pageSize: 50,
    });
    // Replay should not create duplicates for same source versions
    expect(second.candidatesCreated).toBe(0);

    const res = await salesforcePost(
      cronReq("http://localhost/api/jobs/salesforce-sync", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { metrics: Record<string, unknown> };
    expect(body.metrics).not.toHaveProperty("rows");
  });

  it("keeps databricks GET preview-only and POST fail-closed status semantics", async () => {
    const get = await databricksGet(
      new NextRequest("http://localhost/api/jobs/databricks-sync")
    );
    // may 401/503 without secret in header - with secret:
    const getAuthed = await databricksGet(
      new NextRequest("http://localhost/api/jobs/databricks-sync", {
        headers: { authorization: "Bearer cron-test-secret-abcdefgh" },
      })
    );
    expect([200, 502]).toContain(getAuthed.status);
    const body = (await getAuthed.json()) as { preview?: boolean };
    expect(body.preview).toBe(true);

    const post = await databricksPost(
      new NextRequest("http://localhost/api/jobs/databricks-sync?preview=1", {
        method: "POST",
        headers: { authorization: "Bearer cron-test-secret-abcdefgh" },
      })
    );
    expect([200, 502]).toContain(post.status);
    // unauthenticated GET still uses authorizeCron
    expect([401, 503]).toContain(get.status);
  });
});
