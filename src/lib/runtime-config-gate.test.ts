import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeCron } from "@/lib/cron-auth";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("runtime configuration request gate", () => {
  it("rejects invalid configuration before a business route", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("AUTH_MODE", "");
    const response = proxy(new NextRequest("https://precon.example.com/admin"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.diagnostics.issueKeys).toContain("AUTH_MODE");
  });

  it("leaves health endpoints reachable for diagnosis", () => {
    vi.stubEnv("AUTH_MODE", "");
    const response = proxy(
      new NextRequest("http://127.0.0.1/api/health/ready")
    );
    expect(response.status).toBe(200);
  });

  it("never allows a scheduler route when its secret is absent", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = authorizeCron(
      new Request("http://127.0.0.1/api/jobs/reminders")
    );
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({
      error: "Scheduler authentication is unavailable.",
    });
  });
});
