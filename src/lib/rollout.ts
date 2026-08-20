import type { Role } from "@/db/schema";

export const ROLLOUT_SETTINGS_KEY = "roundtableRollout";

export const ROUND_TABLE_FEATURES = [
  "roleChrome",
  "scheduleProjection",
  "scheduleUx",
  "scheduleModes",
  "phaseAwareForm",
  "salesforceSuggestions",
  "organizationGroups",
  "approvalWorkflow",
  "lockRevisions",
  "fieldPolicy",
  "changeAwareness",
  "awardableReporting",
  "sourceIngestion",
  "warehousePublication",
] as const;

export type RoundtableFeature = (typeof ROUND_TABLE_FEATURES)[number];

export type FeatureCohort = {
  enabled: boolean;
  userIds?: number[];
  roles?: Role[];
  regions?: string[];
};

export type RolloutSettings = {
  version: 1;
  features: Partial<Record<RoundtableFeature, FeatureCohort>>;
};

export type RolloutActor = {
  userId: number;
  role: Role;
  region: string | null;
};

const LOW_RISK_DEFAULTS = new Set<RoundtableFeature>([
  "roleChrome",
  "scheduleProjection",
  "scheduleUx",
  "scheduleModes",
  "phaseAwareForm",
  "salesforceSuggestions",
]);

export function isHighRiskFeature(feature: RoundtableFeature): boolean {
  return !LOW_RISK_DEFAULTS.has(feature);
}

export function defaultFeatureEnabled(
  feature: RoundtableFeature,
  _appEnv = process.env.APP_ENV
): boolean {
  if (LOW_RISK_DEFAULTS.has(feature)) return true;
  // High-risk changes stay off until an explicit cohort enables them.
  return false;
}

export function parseRolloutSettings(
  value: Record<string, unknown> | null | undefined
): RolloutSettings {
  const source = value as Partial<RolloutSettings> | null | undefined;
  return {
    version: 1,
    features:
      source?.version === 1 &&
      source.features &&
      typeof source.features === "object"
        ? source.features
        : {},
  };
}

/**
 * Cohorts are an intersection of any supplied filters. Explicitly-disabled
 * features stay disabled even when the actor matches a listed cohort.
 */
export function featureEnabledFor(
  settings: RolloutSettings,
  feature: RoundtableFeature,
  actor: RolloutActor,
  appEnv = process.env.APP_ENV
): boolean {
  const cohort = settings.features[feature];
  if (!cohort) return defaultFeatureEnabled(feature, appEnv);
  if (!cohort.enabled) return false;
  if (cohort.userIds?.length && !cohort.userIds.includes(actor.userId))
    return false;
  if (cohort.roles?.length && !cohort.roles.includes(actor.role)) return false;
  if (
    cohort.regions?.length &&
    (!actor.region || !cohort.regions.includes(actor.region))
  )
    return false;
  return true;
}
