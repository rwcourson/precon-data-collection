import { describe, expect, it } from "vitest";
import type { Role, User } from "@/db/schema";
import {
  allowedTransitions,
  canApproveLock,
  canCreatePursuit,
  canEditAfterLock,
  canEditBidSchedule,
  canEnterPostBid,
  canManageCompanyColumns,
  canManageRegionColumns,
  canViewAudit,
  ROLE_LABELS,
} from "./permissions";

function user(role: Role, region: string | null = "Central"): User {
  return {
    id: 1,
    name: "Test",
    title: role === "rpd" ? "Regional Preconstruction Director / SPD" : role,
    role,
    region,
    preconDepartment: null,
    email: `${role}@example.com`,
  };
}

const round = (
  status:
    | "active"
    | "upcoming"
    | "outstanding"
    | "submitted"
    | "post_bid"
    | "locked",
  region = "Central"
) => ({
  status,
  region,
});

describe("ROLE_LABELS", () => {
  it("labels every role", () => {
    for (const role of Object.keys(ROLE_LABELS) as Role[]) {
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });

  it("presents SPD as an RPD-equivalent title without a new role enum", () => {
    expect(ROLE_LABELS.rpd).toMatch(/SPD/);
    expect(ROLE_LABELS.rpd).toMatch(/RPD/);
  });
});

describe("pursuit and schedule permissions", () => {
  it("allows pcm, estimate_lead, admin_jsa, and rpd to create pursuits", () => {
    expect(canCreatePursuit(user("pcm"))).toBe(true);
    expect(canCreatePursuit(user("estimate_lead"))).toBe(true);
    expect(canCreatePursuit(user("admin_jsa"))).toBe(true);
    expect(canCreatePursuit(user("rpd"))).toBe(true);
    expect(canCreatePursuit(user("leadership"))).toBe(false);
    expect(canCreatePursuit(user("corporate_admin"))).toBe(true);
  });

  it("mirrors create rights for bid-schedule edits", () => {
    expect(canEditBidSchedule(user("pcm"))).toBe(true);
    expect(canEditBidSchedule(user("leadership"))).toBe(false);
  });
});

describe("post-bid entry and lock", () => {
  it("blocks post-bid entry until submitted", () => {
    expect(canEnterPostBid(user("estimate_lead"), round("active"))).toBe(false);
    expect(canEnterPostBid(user("estimate_lead"), round("submitted"))).toBe(
      true
    );
    expect(canEnterPostBid(user("pcm"), round("submitted"))).toBe(false);
  });

  it("allows RPD post-lock edits only in their region", () => {
    expect(canEnterPostBid(user("rpd"), round("locked"))).toBe(true);
    expect(
      canEditAfterLock(user("rpd", "Central"), round("locked", "Central"))
    ).toBe(true);
    expect(
      canEditAfterLock(user("rpd", "Central"), round("locked", "Southeast"))
    ).toBe(false);
    expect(canEditAfterLock(user("estimate_lead"), round("locked"))).toBe(
      false
    );
  });

  it("restricts approve/lock to regional RPD", () => {
    expect(
      canApproveLock(user("rpd", "Central"), round("post_bid", "Central"))
    ).toBe(true);
    expect(
      canApproveLock(user("rpd", "Central"), round("post_bid", "Southeast"))
    ).toBe(false);
    expect(canApproveLock(user("estimate_lead"), round("post_bid"))).toBe(
      false
    );
  });
});

describe("column and audit governance", () => {
  it("splits company vs region column management", () => {
    expect(canManageCompanyColumns(user("corporate_admin"))).toBe(true);
    expect(canManageCompanyColumns(user("rpd"))).toBe(false);
    expect(canManageRegionColumns(user("rpd"))).toBe(true);
    expect(canManageRegionColumns(user("corporate_admin"))).toBe(true);
    expect(canManageRegionColumns(user("pcm"))).toBe(false);
  });

  it("limits audit to rpd and corporate_admin", () => {
    expect(canViewAudit(user("rpd"))).toBe(true);
    expect(canViewAudit(user("corporate_admin"))).toBe(true);
    expect(canViewAudit(user("pcm"))).toBe(false);
  });
});

describe("allowedTransitions", () => {
  it("lets schedule editors move freely among pre-bid buckets", () => {
    const targets = allowedTransitions(user("pcm"), round("active"));
    expect(targets.sort()).toEqual(["outstanding", "upcoming"].sort());
  });

  it("lets estimate leads submit from pre-bid", () => {
    expect(
      allowedTransitions(user("estimate_lead"), round("active"))
    ).toContain("submitted");
    expect(allowedTransitions(user("pcm"), round("active"))).not.toContain(
      "submitted"
    );
  });

  it("requires rpd to lock from post_bid and treats locked as terminal", () => {
    expect(allowedTransitions(user("rpd"), round("post_bid"))).toEqual([
      "locked",
    ]);
    expect(
      allowedTransitions(user("estimate_lead"), round("post_bid"))
    ).toEqual([]);
    expect(allowedTransitions(user("rpd"), round("locked"))).toEqual([]);
  });

  it("moves submitted → post_bid for entry roles", () => {
    expect(allowedTransitions(user("admin_jsa"), round("submitted"))).toEqual([
      "post_bid",
    ]);
  });
});
