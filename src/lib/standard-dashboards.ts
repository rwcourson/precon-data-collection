import type { DashboardWidgetConfig } from "@/db/schema";
import { REFERENCE_LISTS } from "@/lib/reference-data";

export type StandardDashboardDef = {
  name: string;
  description: string;
  scope: "corporate" | "region";
  region: string | null;
  widgets: DashboardWidgetConfig[];
};

function kpi(
  title: string,
  metricKey: DashboardWidgetConfig["metricKey"],
  groupBy?: string
): DashboardWidgetConfig {
  return {
    title,
    kind: "kpi",
    metricKey,
    groupBy: groupBy ?? null,
    layout: { w: 4, h: 2, x: 0, y: 0 },
  };
}

function bar(
  title: string,
  metricKey: DashboardWidgetConfig["metricKey"],
  groupBy: string
): DashboardWidgetConfig {
  return {
    title,
    kind: "bar",
    metricKey,
    groupBy,
    layout: { w: 8, h: 4, x: 0, y: 2 },
  };
}

export const STANDARD_CORPORATE_DASHBOARDS: StandardDashboardDef[] = [
  {
    name: "Standard — Pipeline by status",
    description: "Company-wide pursuit volume and counts by lifecycle status.",
    scope: "corporate",
    region: null,
    widgets: [
      kpi("Estimate rounds", "roundCount"),
      kpi("Win rate", "winRate"),
      bar("Volume by status", "estimateValue", "status"),
    ],
  },
  {
    name: "Standard — Stage counts",
    description: "How many efforts sit in each estimate phase.",
    scope: "corporate",
    region: null,
    widgets: [
      kpi("Rounds", "roundCount"),
      bar("Rounds by estimate phase", "roundCount", "estimatePhase"),
    ],
  },
  {
    name: "Standard — Hit rate",
    description: "Won vs decided outcomes across the portfolio.",
    scope: "corporate",
    region: null,
    widgets: [
      kpi("Win rate", "winRate"),
      bar("Win rate by region", "winRate", "region"),
    ],
  },
];

export function standardRegionDashboard(region: string): StandardDashboardDef {
  return {
    name: `Standard — ${region} pipeline`,
    description: `${region} volume by division, plus stage counts for the region.`,
    scope: "region",
    region,
    widgets: [
      {
        ...kpi("Region rounds", "roundCount"),
        filters: [{ field: "region", op: "eq", value: region }],
      },
      {
        ...bar("Volume by division", "estimateValue", "preconDepartment"),
        filters: [{ field: "region", op: "eq", value: region }],
      },
    ],
  };
}

export function allStandardDashboardDefs(): StandardDashboardDef[] {
  return [
    ...STANDARD_CORPORATE_DASHBOARDS,
    ...REFERENCE_LISTS.region.values.map(standardRegionDashboard),
  ];
}
