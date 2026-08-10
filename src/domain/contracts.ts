import { z } from "zod";

/** Public contracts for new roadmap surfaces. Expand as phases ship. */

export const roundStatusSchema = z.enum([
  "active",
  "upcoming",
  "outstanding",
  "submitted",
  "post_bid",
  "locked",
]);

export const outcomeSchema = z.enum(["pending", "successful", "unsuccessful"]);

export const roleSchema = z.enum([
  "pcm",
  "estimate_lead",
  "admin_jsa",
  "rpd",
  "leadership",
  "corporate_admin",
]);

export const bidScheduleGroupBySchema = z.enum([
  "none",
  "preconDepartment",
  "marketSector",
  "estimatePhase",
  "bidDueDate",
]);

export type BidScheduleGroupBy = z.infer<typeof bidScheduleGroupBySchema>;

export const distributionListSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).nullable(),
  emails: z
    .array(z.string().trim().email())
    .min(1)
    .max(100),
  cadence: z.enum(["manual", "weekly"]).default("manual"),
  reportKey: z.string().trim().min(1).max(80),
  timezone: z.string().trim().min(1).max(64).default("America/Chicago"),
});

export type DistributionListInput = z.infer<typeof distributionListSchema>;

export const apiTokenScopeSchema = z.enum([
  "profile:read",
  "read:pursuits",
  "read:reports",
  "read:dashboards",
  "read:sheets",
  "read:notifications",
  "read:admin",
  "read:trash",
  "write:pursuits",
  "write:reports",
  "write:dashboards",
  "write:sheets",
  "write:notifications",
  "write:admin",
  "write:trash",
  "write:destructive",
  "integrate:connect",
  "admin:tokens",
]);

export type ApiTokenScope = z.infer<typeof apiTokenScopeSchema>;

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(apiTokenScopeSchema).min(1),
  expiresAt: z.string().datetime(),
  regionAllowlist: z.array(z.string().trim().min(1)).default([]),
});

export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;

export const matchDecisionSchema = z.enum([
  "approve",
  "reject",
  "dismiss",
  "relink",
]);

export const dashboardScopeSchema = z.enum(["personal", "region", "corporate"]);

export const widgetKindSchema = z.enum([
  "kpi",
  "table",
  "bar",
  "horizontal_bar",
  "stacked_bar",
  "line",
  "area",
  "pie",
  "donut",
  "projection",
  "reconciliation",
]);
