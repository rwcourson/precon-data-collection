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
  "estimateLead",
  "bidDueDate",
  "bidDueMonth",
  "drawingsDueDate",
  "bidReviewDate",
]);

export type BidScheduleGroupBy = z.infer<typeof bidScheduleGroupBySchema>;

export const createPursuitSchema = z.object({
  mode: z.enum(["salesforce", "manual"]),
  sfId: z.string().trim().min(1).optional(),
  jobName: z.string().trim().max(240).optional(),
  region: z.string().trim().min(1).max(80),
  preconDepartment: z.string().trim().min(1).max(120),
  estimatePhase: z.string().trim().min(1).max(120),
  bidYear: z.number().int().min(2000).max(2100),
  bidDueDate: z.string().trim().optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(40).optional(),
  marketSector: z.string().trim().max(120).optional(),
  mlt: z.string().trim().max(80).optional(),
  contractType: z.string().trim().max(80).optional(),
  procurement: z.string().trim().max(80).optional(),
  statusAtPricing: z.string().trim().max(80).optional(),
  initialStatus: z.enum(["active", "upcoming", "outstanding"]),
  confirmDuplicate: z.boolean().optional(),
});

export const jobVisibilityRegionSchema = z.object({
  jobId: z.number().int().positive(),
  region: z.string().trim().min(1).max(80),
});

export const jobVisibilityUserSchema = z.object({
  jobId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export const adoptJobVisibilitySchema = z.object({
  jobId: z.number().int().positive(),
});

export const createRoundNoteSchema = z.object({
  roundId: z.number().int().positive(),
  body: z.string().trim().min(1).max(10_000),
});

export const editRoundNoteSchema = z.object({
  noteId: z.number().int().positive(),
  body: z.string().trim().min(1).max(10_000),
});

export const roundNoteIdSchema = z.object({
  noteId: z.number().int().positive(),
});

export const markTeamAssignedSchema = z.object({
  roundId: z.number().int().positive(),
  assigned: z.boolean(),
});

export const distributionListSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).nullable(),
  emails: z.array(z.string().trim().email()).min(1).max(100),
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
  /** Volume bars + win-rate line by bid year (chart-elements ComboChart). */
  "combo",
  /** Portfolio bridge: won / pending / lost / total (chart-elements WaterfallChart). */
  "waterfall",
]);
