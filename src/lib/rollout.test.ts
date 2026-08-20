import { describe, expect, it } from "vitest";
import {
  featureEnabledFor,
  isHighRiskFeature,
  parseRolloutSettings,
  type RolloutActor,
} from "./rollout";

const pcm: RolloutActor = {
  userId: 12,
  role: "pcm",
  region: "Florida",
};

describe("roundtable rollout cohorts", () => {
  it("enables low-risk features and keeps high-risk production changes off", () => {
    const settings = parseRolloutSettings(null);
    expect(featureEnabledFor(settings, "roleChrome", pcm, "production")).toBe(
      true
    );
    expect(
      featureEnabledFor(settings, "warehousePublication", pcm, "production")
    ).toBe(false);
    expect(
      featureEnabledFor(settings, "warehousePublication", pcm, "demo")
    ).toBe(false);
  });

  it("requires every configured cohort filter to match", () => {
    const settings = parseRolloutSettings({
      version: 1,
      features: {
        approvalWorkflow: {
          enabled: true,
          userIds: [12],
          roles: ["pcm"],
          regions: ["Florida"],
        },
      },
    });
    expect(
      featureEnabledFor(settings, "approvalWorkflow", pcm, "production")
    ).toBe(true);
    expect(
      featureEnabledFor(
        settings,
        "approvalWorkflow",
        { ...pcm, region: "Texas" },
        "production"
      )
    ).toBe(false);
  });

  it("honors an explicit disable for matching actors", () => {
    const settings = parseRolloutSettings({
      version: 1,
      features: { scheduleModes: { enabled: false, roles: ["pcm"] } },
    });
    expect(featureEnabledFor(settings, "scheduleModes", pcm, "demo")).toBe(
      false
    );
  });

  it("classifies warehouse and approvals as high-risk defaults", () => {
    expect(isHighRiskFeature("warehousePublication")).toBe(true);
    expect(isHighRiskFeature("approvalWorkflow")).toBe(true);
    expect(isHighRiskFeature("roleChrome")).toBe(false);
  });
});
