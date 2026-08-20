"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveRoundtableRollout } from "@/actions/rollout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type FeatureCohort,
  isHighRiskFeature,
  ROUND_TABLE_FEATURES,
  type RolloutSettings,
  type RoundtableFeature,
} from "@/lib/rollout";

type Draft = Record<
  RoundtableFeature,
  { enabled: boolean; roles: string; regions: string; userIds: string }
>;

function toDraft(settings: RolloutSettings): Draft {
  return Object.fromEntries(
    ROUND_TABLE_FEATURES.map((feature) => {
      const cohort = settings.features[feature];
      return [
        feature,
        {
          enabled: Boolean(cohort?.enabled),
          roles: (cohort?.roles ?? []).join(", "),
          regions: (cohort?.regions ?? []).join(", "),
          userIds: (cohort?.userIds ?? []).join(", "),
        },
      ];
    })
  ) as Draft;
}

export function RolloutSettingsPanel({
  settings,
  canEdit,
}: {
  settings: RolloutSettings;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState(() => toDraft(settings));
  const [pending, start] = useTransition();
  const router = useRouter();

  const patch = (
    feature: RoundtableFeature,
    next: Partial<Draft[RoundtableFeature]>
  ) =>
    setDraft((current) => ({
      ...current,
      [feature]: { ...current[feature], ...next },
    }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          Roundtable pilot configuration
        </CardTitle>
        <CardDescription>
          High-risk flags stay off until an explicit cohort is saved. Disable a
          flag to restore the previous path; additive schema stays dormant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ROUND_TABLE_FEATURES.map((feature) => (
          <div
            key={feature}
            className="grid gap-2 rounded-md border px-3 py-2 sm:grid-cols-[10rem_auto_1fr]"
          >
            <div className="flex items-center gap-2">
              <Checkbox
                checked={draft[feature].enabled}
                disabled={!canEdit}
                onCheckedChange={(checked) =>
                  patch(feature, { enabled: checked === true })
                }
              />
              <Label className="font-mono text-xs">{feature}</Label>
            </div>
            <div className="flex items-center">
              {isHighRiskFeature(feature) ? (
                <Badge variant="warning" size="sm">
                  High risk
                </Badge>
              ) : (
                <Badge variant="secondary" size="sm">
                  Low risk
                </Badge>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                disabled={!canEdit}
                placeholder="roles, comma-separated"
                value={draft[feature].roles}
                onChange={(event) =>
                  patch(feature, { roles: event.target.value })
                }
              />
              <Input
                disabled={!canEdit}
                placeholder="regions"
                value={draft[feature].regions}
                onChange={(event) =>
                  patch(feature, { regions: event.target.value })
                }
              />
              <Input
                disabled={!canEdit}
                placeholder="user ids"
                value={draft[feature].userIds}
                onChange={(event) =>
                  patch(feature, { userIds: event.target.value })
                }
              />
            </div>
          </div>
        ))}
        {canEdit ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const features: RolloutSettings["features"] = {};
                  for (const feature of ROUND_TABLE_FEATURES) {
                    const row = draft[feature];
                    const cohort: FeatureCohort = {
                      enabled: row.enabled,
                    };
                    const roles = row.roles
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean);
                    const regions = row.regions
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean);
                    const userIds = row.userIds
                      .split(",")
                      .map((value) => Number(value.trim()))
                      .filter((value) => Number.isInteger(value) && value > 0);
                    if (roles.length)
                      cohort.roles = roles as FeatureCohort["roles"];
                    if (regions.length) cohort.regions = regions;
                    if (userIds.length) cohort.userIds = userIds;
                    if (
                      cohort.enabled ||
                      roles.length ||
                      regions.length ||
                      userIds.length
                    )
                      features[feature] = cohort;
                  }
                  await saveRoundtableRollout({ version: 1, features });
                  toast.success("Pilot configuration saved");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not save pilot configuration"
                  );
                }
              })
            }
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save cohorts
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
