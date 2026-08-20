import { describe, expect, it } from "vitest";
import type { Role, User } from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import { explainWhoCanEdit } from "./who-can-edit";

function principal(role: Role) {
  const user: User = {
    id: 1,
    name: role,
    title: role,
    role,
    region: "Central",
    preconDepartment: null,
    email: `${role}@example.com`,
  };
  return createPrincipal({
    user,
    authSource: "demo_session",
    workspaceRegion: "Central",
  });
}

describe("who can edit this", () => {
  it("explains proposal, read, and lock-immutable modes from the kernel and policy", () => {
    expect(
      explainWhoCanEdit({
        principal: principal("pcm"),
        writeMode: "propose",
        locked: false,
        lockImmutable: false,
        scheduleMode: true,
        roundId: 10,
        region: "Central",
        status: "upcoming",
      })
    ).toMatch(/approval request/);
    expect(
      explainWhoCanEdit({
        principal: principal("leadership"),
        writeMode: "read",
        locked: false,
        lockImmutable: false,
        scheduleMode: false,
        roundId: 10,
        region: "Central",
        status: "post_bid",
      })
    ).toMatch(/cannot edit/);
    expect(
      explainWhoCanEdit({
        principal: principal("rpd"),
        writeMode: "direct",
        locked: true,
        lockImmutable: true,
        scheduleMode: false,
        roundId: 10,
        region: "Central",
        status: "locked",
      })
    ).toMatch(/immutable/);
  });
});
