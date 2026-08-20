import { describe, expect, it } from "vitest";
import type { Role, User } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { planOutcomeUpdate } from "./outcome";

function user(role: Role, region: string | null = "Central"): User {
  return {
    id: 1,
    name: "Test",
    title: role === "rpd" ? "SPD" : role,
    role,
    region,
    preconDepartment: null,
    email: `${role}@example.com`,
  };
}

describe("post-lock outcome correction", () => {
  it("allows RPD/SPD to change outcome and emits an audit entry", () => {
    const { audit } = planOutcomeUpdate(
      user("rpd", "Central"),
      {
        id: 9,
        status: "locked",
        region: "Central",
        outcome: "pending",
      },
      "successful"
    );

    expect(audit).toEqual({
      entity: "round",
      entityId: 9,
      roundId: 9,
      action: "field_changed",
      field: "outcome",
      oldValue: "pending",
      newValue: "successful",
    });
  });

  it("rejects an in-place outcome change when lock revisions are enabled", () => {
    expect(() =>
      planOutcomeUpdate(
        user("rpd"),
        {
          id: 9,
          status: "locked",
          region: "Central",
          outcome: "pending",
        },
        "unsuccessful",
        { lockImmutable: true }
      )
    ).toThrow(DomainError);
  });

  it("skips audit when the locked outcome is unchanged", () => {
    const { audit } = planOutcomeUpdate(
      user("rpd"),
      {
        id: 9,
        status: "locked",
        region: "Central",
        outcome: "successful",
      },
      "successful"
    );
    expect(audit).toBeNull();
  });
});
