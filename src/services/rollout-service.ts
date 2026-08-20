import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import type { Principal } from "@/lib/authorization/types";
import {
  type FeatureCohort,
  featureEnabledFor,
  parseRolloutSettings,
  ROLLOUT_SETTINGS_KEY,
  ROUND_TABLE_FEATURES,
  type RolloutSettings,
  type RoundtableFeature,
} from "@/lib/rollout";

export async function loadRolloutSettings(): Promise<RolloutSettings> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, ROLLOUT_SETTINGS_KEY));
  return parseRolloutSettings(row?.value);
}

function actorFor(principal: Principal) {
  return {
    userId: principal.user.id,
    role: principal.user.role,
    region:
      principal.workspace.kind === "region"
        ? principal.workspace.region
        : principal.user.region,
  };
}

export async function roundtableFeatureEnabled(
  principal: Principal,
  feature: RoundtableFeature
): Promise<boolean> {
  const settings = await loadRolloutSettings();
  return featureEnabledFor(settings, feature, actorFor(principal));
}

export async function roundtableFeaturesFor(
  principal: Principal
): Promise<Record<RoundtableFeature, boolean>> {
  const settings = await loadRolloutSettings();
  const actor = actorFor(principal);
  return Object.fromEntries(
    ROUND_TABLE_FEATURES.map((feature) => [
      feature,
      featureEnabledFor(settings, feature, actor),
    ])
  ) as Record<RoundtableFeature, boolean>;
}

/** System-wide warehouse writes require an explicit cohort enablement. */
export async function warehousePublicationEnabled(): Promise<boolean> {
  const settings = await loadRolloutSettings();
  return settings.features.warehousePublication?.enabled === true;
}

export async function saveRolloutSettings(
  principal: Principal,
  next: RolloutSettings
): Promise<RolloutSettings> {
  const parsed = parseRolloutSettings(next);
  const features: RolloutSettings["features"] = {};
  for (const key of ROUND_TABLE_FEATURES) {
    const cohort = parsed.features[key];
    if (!cohort) continue;
    features[key] = sanitizeCohort(cohort);
  }
  const value: RolloutSettings = { version: 1, features };
  await db
    .insert(appSettings)
    .values({
      key: ROLLOUT_SETTINGS_KEY,
      value,
      updatedById: principal.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value,
        updatedById: principal.user.id,
        updatedAt: new Date(),
      },
    });
  return value;
}

function sanitizeCohort(cohort: FeatureCohort): FeatureCohort {
  const cleaned: FeatureCohort = { enabled: Boolean(cohort.enabled) };
  if (cohort.userIds?.length)
    cleaned.userIds = cohort.userIds.filter(
      (id) => Number.isInteger(id) && id > 0
    );
  if (cohort.roles?.length) cleaned.roles = cohort.roles;
  if (cohort.regions?.length)
    cleaned.regions = cohort.regions
      .map((region) => region.trim())
      .filter(Boolean);
  return cleaned;
}
