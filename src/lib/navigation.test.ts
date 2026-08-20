import { describe, expect, it } from "vitest";
import { navigationForRole } from "./navigation";

function hrefs(
  role: Parameters<typeof navigationForRole>[0],
  roleChrome = true
) {
  return navigationForRole(role, { roleChrome }).flatMap((section) =>
    section.items.map((item) => item.href)
  );
}

describe("role-aware navigation", () => {
  it.each(["pcm", "estimate_lead"] as const)(
    "keeps %s on the three-item rollout surface",
    (role) => {
      expect(hrefs(role)).toEqual(["/", "/bid-schedule", "/post-bid"]);
    }
  );

  it("keeps operational tools for RPDs", () => {
    const links = hrefs("rpd");
    expect(links).toContain("/admin");
    expect(links).toContain("/copilot");
  });

  it("does not expose Admin to leadership", () => {
    expect(hrefs("leadership")).not.toContain("/admin");
  });

  it("restores Tools and More for PCM when role chrome is off", () => {
    const links = hrefs("pcm", false);
    expect(links).toContain("/copilot");
    expect(links).toContain("/dashboards");
    expect(links).not.toContain("/admin");
  });
});
