import { describe, expect, it } from "vitest";
import { canWriteField, resolveSheetCapability } from "./policy";
import type { User } from "@/db/schema";

function user(partial: Partial<User> & Pick<User, "role">): User {
  return {
    id: 1,
    name: "Test",
    title: "T",
    email: "t@example.com",
    region: "Central",
    preconDepartment: null,
    ...partial,
  };
}

describe("field write policy", () => {
  it("denies leadership all writes", () => {
    expect(
      canWriteField(user({ role: "leadership" }), "estimateValue", {
        status: "post_bid",
        region: "Central",
      }),
    ).toBe(false);
  });

  it("allows estimate_lead post-bid entry", () => {
    expect(
      canWriteField(user({ role: "estimate_lead" }), "estimateValue", {
        status: "post_bid",
        region: "Central",
      }),
    ).toBe(true);
  });

  it("allows rpd locked corrections", () => {
    expect(
      canWriteField(user({ role: "rpd" }), "estimateValue", {
        status: "locked",
        region: "Central",
      }),
    ).toBe(true);
  });

  it("denies pcm post-bid writes", () => {
    expect(
      canWriteField(user({ role: "pcm" }), "estimateValue", {
        status: "post_bid",
        region: "Central",
      }),
    ).toBe(false);
  });

  it("denies rpd writing another region's locked round", () => {
    expect(
      canWriteField(user({ role: "rpd", region: "Central" }), "estimateValue", {
        status: "locked",
        region: "Southeast",
      }),
    ).toBe(false);
  });

  it("allows admin_jsa post-bid", () => {
    expect(
      canWriteField(user({ role: "admin_jsa" }), "feeExpected", {
        status: "submitted",
        region: "Central",
      }),
    ).toBe(true);
  });

  it("allows corporate_admin field writes (corporate admin is elevated)", () => {
    expect(
      canWriteField(user({ role: "corporate_admin", region: null }), "city", {
        status: "active",
        region: "Central",
      }),
    ).toBe(true);
  });
});

describe("sheet ACL", () => {
  it("defaults corporate sheets to corporate_admin manager", () => {
    expect(
      resolveSheetCapability(
        user({ role: "corporate_admin", region: null }),
        { region: null, ownerId: null },
        [],
      ),
    ).toBe("manager");
  });

  it("defaults corporate sheets to viewer for others", () => {
    expect(
      resolveSheetCapability(
        user({ role: "rpd" }),
        { region: null, ownerId: null },
        [],
      ),
    ).toBe("viewer");
  });

  it("honors explicit ACL over defaults", () => {
    expect(
      resolveSheetCapability(
        user({ role: "pcm", id: 9 }),
        { region: "Central", ownerId: 1 },
        [
          {
            userId: 9,
            grantRole: null,
            acl: "manager",
            regionAllowlist: [],
          },
        ],
      ),
    ).toBe("manager");
  });
});
