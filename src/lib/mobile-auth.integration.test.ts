import { describe, expect, it } from "vitest";
import { demoAuthGate, publicUser, isDemoAuthAllowed } from "./mobile-auth";
import { authMode } from "./auth";

describe("mobile auth contract", () => {
  it("demo gate rejects sso", () => {
    expect(demoAuthGate("sso").allowed).toBe(false);
  });

  it("isDemoAuthAllowed mirrors authMode", () => {
    expect(isDemoAuthAllowed()).toBe(authMode() === "demo");
  });

  it("publicUser keeps role for client RBAC display", () => {
    const u = publicUser({
      id: 9,
      name: "Bryan",
      title: "RPD",
      role: "rpd",
      region: "Central",
      preconDepartment: null,
      email: "bryan@example.com",
    });
    expect(u.role).toBe("rpd");
    expect(u.id).toBe(9);
  });
});
