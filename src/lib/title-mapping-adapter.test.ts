import { describe, expect, it } from "vitest";
import { type AccessSettings, DEFAULT_ACCESS } from "@/lib/access-map";
import { previewIdentityMapping } from "@/lib/title-mapping-adapter";

describe("title and reporting-chain mapping", () => {
  const access: AccessSettings = {
    ...DEFAULT_ACCESS,
    titleRoles: { pcm: "pcm", "preconstruction director": "rpd" },
    managerRoles: { "rpd@example.com": "rpd" },
    emailRoles: { "override@example.com": "corporate_admin" },
  };

  it("uses governed title before Entra groups", () => {
    const mapped = previewIdentityMapping(
      {
        email: "title-user@example.com",
        name: "Title User",
        title: "PCM",
        groups: ["BG-Precon-RPD", "BG-Region-Central"],
      },
      access
    );
    expect(mapped.source).toBe("title");
    expect(mapped.role).toBe("pcm");
    expect(mapped.region).toBe("Central");
  });

  it("falls back to manager then groups, and honors email overrides", () => {
    expect(
      previewIdentityMapping(
        {
          email: "report@example.com",
          name: "Report",
          managerEmail: "rpd@example.com",
          groups: ["BG-Precon-PCM"],
        },
        access
      ).role
    ).toBe("rpd");
    expect(
      previewIdentityMapping(
        {
          email: "group-only@example.com",
          name: "Group",
          groups: ["BG-Precon-SPD", "BG-Region-Texas"],
        },
        access
      )
    ).toMatchObject({ source: "group", role: "rpd", region: "Texas" });
    expect(
      previewIdentityMapping(
        {
          email: "override@example.com",
          name: "Override",
          title: "PCM",
          groups: ["BG-Precon-PCM"],
        },
        access
      ).role
    ).toBe("corporate_admin");
  });

  it("fails closed when email, title, manager, and groups are unmapped", () => {
    expect(
      previewIdentityMapping(
        {
          email: "nobody@example.com",
          name: "Nobody",
          groups: [],
        },
        access
      )
    ).toMatchObject({ source: "unmapped", role: null, matchedKey: null });
  });
});
