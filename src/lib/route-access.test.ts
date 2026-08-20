import { describe, expect, it } from "vitest";
import { roleMayAccessPath } from "./route-access";

describe("role-aware route denial", () => {
  it("keeps PCM and estimate leads on pipeline destinations", () => {
    expect(roleMayAccessPath("pcm", "/")).toBe(true);
    expect(roleMayAccessPath("pcm", "/bid-schedule")).toBe(true);
    expect(roleMayAccessPath("pcm", "/post-bid")).toBe(true);
    expect(roleMayAccessPath("pcm", "/jobs/12")).toBe(true);
    expect(roleMayAccessPath("pcm", "/rounds/9")).toBe(true);
    expect(roleMayAccessPath("estimate_lead", "/copilot")).toBe(false);
    expect(roleMayAccessPath("pcm", "/dashboards")).toBe(false);
    expect(roleMayAccessPath("pcm", "/admin")).toBe(false);
  });

  it("lets leadership use dashboards but not Copilot", () => {
    expect(roleMayAccessPath("leadership", "/dashboards")).toBe(true);
    expect(roleMayAccessPath("leadership", "/copilot")).toBe(false);
  });

  it("does not hide operational tools from RPDs", () => {
    expect(roleMayAccessPath("rpd", "/copilot")).toBe(true);
    expect(roleMayAccessPath("rpd", "/admin")).toBe(true);
  });

  it("restores Copilot for PCM when role chrome is disabled", () => {
    expect(roleMayAccessPath("pcm", "/copilot", { roleChrome: false })).toBe(
      true
    );
    expect(roleMayAccessPath("pcm", "/admin", { roleChrome: false })).toBe(
      false
    );
  });
});
