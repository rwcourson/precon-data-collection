import { describe, expect, it } from "vitest";
import { demoAuthGate, publicUser } from "./mobile-auth";

describe("demoAuthGate", () => {
  it("allows demo mode", () => {
    expect(demoAuthGate("demo")).toEqual({ allowed: true });
  });

  it("rejects sso mode", () => {
    const r = demoAuthGate("sso");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/not demo/i);
  });
});

describe("publicUser", () => {
  it("strips nothing critical and maps fields", () => {
    const u = publicUser({
      id: 1,
      name: "Sarah Chen",
      title: "PCM",
      role: "pcm",
      region: "Central",
      preconDepartment: "Central Precon",
      email: "sarah@example.com",
    });
    expect(u.id).toBe(1);
    expect(u.role).toBe("pcm");
    expect(u.email).toContain("@");
  });
});
