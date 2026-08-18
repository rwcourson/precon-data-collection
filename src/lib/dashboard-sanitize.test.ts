import { describe, expect, it } from "vitest";
import type { CopilotPlan } from "./dashboard-copilot";
import { sanitizePlan, sanitizeWidgetConfig } from "./dashboard-sanitize";

const layout = { w: 3, h: 2, x: 0, y: 0 };

describe("dashboard sanitize allowlists", () => {
  it("maps unknown metrics onto an allowlisted default and drops illegal filters", () => {
    const cleaned = sanitizeWidgetConfig({
      title: "estimateValue leak",
      kind: "bar",
      metricKey: "ssn",
      groupBy: "email",
      filters: [
        { field: "password", op: "eq", value: "secret" },
        { field: "region", op: "eq", value: "florida" },
      ],
      layout,
    });
    expect(cleaned.metricKey).toBe("estimateValue");
    expect(cleaned.groupBy).toBe("region");
    expect(cleaned.filters).toEqual([
      { field: "region", op: "eq", value: "Florida" },
    ]);
  });

  it("keeps an on-list plan intact", () => {
    const plan: CopilotPlan = {
      name: "Florida volume",
      description: "allowlisted",
      scope: "personal",
      widgets: [
        {
          title: "Win rate",
          kind: "kpi",
          metricKey: "winRate",
          filters: [{ field: "region", op: "eq", value: "Florida" }],
          layout,
        },
      ],
      rationale: [],
      engine: "rules",
    };
    const cleaned = sanitizePlan(plan);
    expect(cleaned.widgets[0]!.metricKey).toBe("winRate");
    expect(cleaned.widgets[0]!.filters).toEqual([
      { field: "region", op: "eq", value: "Florida" },
    ]);
  });
});
