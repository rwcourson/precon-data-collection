import { describe, expect, it } from "vitest";
import { resolveDisplayName, resolveJobTitle } from "@/lib/auth";
import type { User } from "@/db/schema";

function roster(partial: Partial<User>): User {
  return {
    id: 1,
    name: "Sarah Chen",
    title: "Preconstruction Manager",
    role: "pcm",
    region: "Central",
    preconDepartment: "Central Building Group",
    email: "schen@brasfieldgorrie.com",
    ...partial,
  };
}

describe("SSO name/title matching", () => {
  it("prefers Entra display name over roster when real", () => {
    expect(
      resolveDisplayName(
        { email: "schen@brasfieldgorrie.com", name: "S. Chen", groups: [] },
        roster({}),
      ),
    ).toBe("S. Chen");
  });

  it("keeps roster name when IdP only has email local-part", () => {
    expect(
      resolveDisplayName(
        { email: "schen@brasfieldgorrie.com", name: "schen", groups: [] },
        roster({ name: "Sarah Chen" }),
      ),
    ).toBe("Sarah Chen");
  });

  it("prefers Entra job title, then roster, then role label", () => {
    expect(
      resolveJobTitle(
        {
          email: "x@brasfieldgorrie.com",
          name: "X",
          groups: [],
          title: "Senior Estimator",
        },
        "estimate_lead",
        roster({ title: "Old Title" }),
      ),
    ).toBe("Senior Estimator");

    expect(
      resolveJobTitle(
        { email: "x@brasfieldgorrie.com", name: "X", groups: [] },
        "pcm",
        roster({ title: "Preconstruction Manager" }),
      ),
    ).toBe("Preconstruction Manager");

    expect(
      resolveJobTitle(
        { email: "x@brasfieldgorrie.com", name: "X", groups: [] },
        "rpd",
        roster({ title: "Signed in via SSO" }),
      ),
    ).toBe("RPD / SPD");
  });
});
