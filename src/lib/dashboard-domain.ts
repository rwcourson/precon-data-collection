import { z } from "zod";
import { dashboardScopeSchema, widgetKindSchema } from "@/domain/contracts";

export const widgetConfigSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: widgetKindSchema,
  savedReportId: z.number().int().positive().nullable().optional(),
  metricKey: z.string().trim().min(1).max(80).nullable().optional(),
  groupBy: z.string().trim().min(1).max(80).nullable().optional(),
  filters: z
    .array(
      z.object({
        field: z.string().min(1),
        op: z.string().min(1),
        value: z.string(),
      })
    )
    .max(20)
    .optional(),
  format: z.string().max(40).nullable().optional(),
  layout: z
    .object({
      w: z.number().int().min(1).max(12),
      h: z.number().int().min(1).max(12),
      x: z.number().int().min(0).max(11),
      y: z.number().int().min(0).max(40),
    })
    .optional(),
});

export const dashboardCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  scope: dashboardScopeSchema.default("personal"),
  region: z.string().trim().min(1).nullable().optional(),
  published: z.boolean().optional(),
  widgets: z.array(widgetConfigSchema).max(40).default([]),
});

export type DashboardCreateInput = z.infer<typeof dashboardCreateSchema>;

const ALLOWED_METRICS = new Set([
  "estimateValue",
  "feeExpected",
  "feeExpectedPct",
  "contingencyTotal",
  "roundCount",
  "winRate",
]);

const ALLOWED_GROUP_BY = new Set([
  "region",
  "preconDepartment",
  "marketSector",
  "estimatePhase",
  "bidYear",
  "status",
  "outcome",
  "sizeBucket",
]);

export function assertWidgetQueryBounds(
  config: z.infer<typeof widgetConfigSchema>
): void {
  if (
    config.metricKey &&
    !ALLOWED_METRICS.has(config.metricKey) &&
    !config.savedReportId
  ) {
    throw new Error(`Metric "${config.metricKey}" is not allowlisted`);
  }
  if (config.groupBy && !ALLOWED_GROUP_BY.has(config.groupBy)) {
    throw new Error(`groupBy "${config.groupBy}" is not allowlisted`);
  }
  for (const f of config.filters ?? []) {
    if (!/^[a-zA-Z0-9_.:]+$/.test(f.field)) {
      throw new Error(`Filter field "${f.field}" is invalid`);
    }
    if (!["eq", "contains", "gt", "lt", "gte", "lte"].includes(f.op)) {
      throw new Error(`Filter op "${f.op}" is not allowlisted`);
    }
  }
}

export function canPublishDashboard(
  role: string,
  scope: z.infer<typeof dashboardScopeSchema>
): boolean {
  if (scope === "personal") return true;
  if (scope === "region") return role === "rpd" || role === "corporate_admin";
  if (scope === "corporate") return role === "corporate_admin";
  return false;
}
