import { describe, expect, it } from "vitest";
import { DEFAULT_ACCESS, mapIdentity } from "./access-map";

describe("SSO group → role mapping", () => {
  it("maps the SPD group alias to the rpd role", () => {
    expect(DEFAULT_ACCESS.groupRoles["BG-Precon-SPD"]).toBe("rpd");
    const mapped = mapIdentity(
      {
        email: "spd@example.com",
        name: "SPD User",
        groups: ["BG-Precon-SPD", "BG-Region-Central"],
      },
      DEFAULT_ACCESS,
    );
    expect(mapped.role).toBe("rpd");
    expect(mapped.region).toBe("Central");
  });
});
