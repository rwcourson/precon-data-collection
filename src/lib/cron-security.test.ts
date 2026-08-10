import { describe, expect, it } from "vitest";
import { authorizeCron } from "@/lib/cron-auth";

describe("cron authorization matrix", () => {
  it("rejects missing cron secret configuration", () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const res = authorizeCron(new Request("http://localhost/api/jobs/distribution", { method: "POST" }));
    expect(res?.status).toBe(503);
    if (previous) process.env.CRON_SECRET = previous;
  });

  it("rejects wrong bearer credentials", () => {
    process.env.CRON_SECRET = "expected-secret-value-123456";
    const res = authorizeCron(
      new Request("http://localhost/api/jobs/distribution", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret-value-123456" },
      }),
    );
    expect(res?.status).toBe(401);
  });

  it("accepts correct bearer credentials", () => {
    process.env.CRON_SECRET = "expected-secret-value-123456";
    const res = authorizeCron(
      new Request("http://localhost/api/jobs/distribution", {
        method: "POST",
        headers: { authorization: "Bearer expected-secret-value-123456" },
      }),
    );
    expect(res).toBeNull();
  });
});
