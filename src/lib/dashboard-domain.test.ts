import { describe, expect, it } from "vitest";
import {
  assertWidgetQueryBounds,
  canPublishDashboard,
  dashboardCreateSchema,
} from "./dashboard-domain";

describe("dashboard domain", () => {
  it("validates create payload", () => {
    const parsed = dashboardCreateSchema.parse({
      name: "My board",
      scope: "personal",
      widgets: [{ title: "Volume", kind: "kpi", metricKey: "estimateValue" }],
    });
    expect(parsed.widgets).toHaveLength(1);
  });

  it("rejects non-allowlisted metrics and ops", () => {
    expect(() =>
      assertWidgetQueryBounds({
        title: "X",
        kind: "bar",
        metricKey: "drop_table",
      }),
    ).toThrow(/allowlisted/);
    expect(() =>
      assertWidgetQueryBounds({
        title: "X",
        kind: "table",
        filters: [{ field: "region", op: "nuke", value: "x" }],
      }),
    ).toThrow(/allowlisted/);
  });

  it("gates publish by scope", () => {
    expect(canPublishDashboard("pcm", "corporate")).toBe(false);
    expect(canPublishDashboard("corporate_admin", "corporate")).toBe(true);
    expect(canPublishDashboard("rpd", "region")).toBe(true);
  });
});
