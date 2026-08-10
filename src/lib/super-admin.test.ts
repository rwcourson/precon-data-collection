import { describe, expect, it } from "vitest";
import {
  isCorporateAdmin,
  isSuperAdmin,
  isSuperAdminEmail,
} from "@/lib/super-admin";

describe("super-admin", () => {
  it("recognizes rcourson as platform super admin", () => {
    expect(isSuperAdminEmail("rcourson@brasfieldgorrie.com")).toBe(true);
    expect(isSuperAdminEmail("RCourson@BrasfieldGorrie.com")).toBe(true);
    expect(
      isSuperAdmin({
        email: "rcourson@brasfieldgorrie.com",
        role: "pcm",
      }),
    ).toBe(true);
  });

  it("treats super admin and corporate_admin as elevated", () => {
    expect(
      isCorporateAdmin({
        email: "rcourson@brasfieldgorrie.com",
        role: "pcm",
      }),
    ).toBe(true);
    expect(
      isCorporateAdmin({
        email: "other@brasfieldgorrie.com",
        role: "corporate_admin",
      }),
    ).toBe(true);
    expect(
      isCorporateAdmin({
        email: "other@brasfieldgorrie.com",
        role: "pcm",
      }),
    ).toBe(false);
  });
});
