import { describe, expect, it } from "vitest";
import { DEFAULT_DEMO_RPD, pickDefaultDemoUser } from "./demo-identity";

describe("pickDefaultDemoUser", () => {
  it("prefers Brian Meyers even when another user is first", () => {
    const picked = pickDefaultDemoUser([
      { name: "Sarah Chen", role: "pcm" },
      { name: DEFAULT_DEMO_RPD.name, role: "rpd" },
      { name: "Tom Reeves", role: "corporate_admin" },
    ]);
    expect(picked.name).toBe("Brian Meyers");
    expect(picked.role).toBe("rpd");
  });

  it("falls back to the first RPD, then the first roster row", () => {
    expect(pickDefaultDemoUser([{ name: "Other", role: "rpd" }]).name).toBe("Other");
    expect(pickDefaultDemoUser([{ name: "Sarah Chen", role: "pcm" }]).name).toBe("Sarah Chen");
  });
});
