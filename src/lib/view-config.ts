import { z } from "zod";

const bidScheduleViewConfigV1Schema = z.object({
  version: z.literal(1).optional(),
  section: z.string().optional(),
  group: z.string().optional(),
  sort: z.string().optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  region: z.string().optional(),
  queue: z.string().optional(),
  columns: z.array(z.string()).optional(),
  density: z.enum(["summary", "detail"]).optional(),
});

const bidScheduleViewConfigV2Schema = bidScheduleViewConfigV1Schema.extend({
  version: z.literal(2).optional(),
  regions: z.array(z.string()).optional(),
  departments: z.array(z.string()).optional(),
});

export type BidScheduleViewConfigV2 = {
  version: 2;
  section?: string;
  group?: string;
  sort?: string;
  dir?: "asc" | "desc";
  region?: string;
  queue?: string;
  columns?: string[];
  density?: "summary" | "detail";
  regions: string[];
  departments: string[];
};

const DEFAULTS: BidScheduleViewConfigV2 = {
  version: 2,
  regions: [],
  departments: [],
};

/** Parse saved-view JSONB. Unknown/legacy shapes fall back to v2 defaults without throwing. */
export function parseBidScheduleViewConfig(
  raw: unknown
): BidScheduleViewConfigV2 {
  const parsed = bidScheduleViewConfigV2Schema.safeParse(raw);
  const base = parsed.success ? parsed.data : {};
  const v1 = bidScheduleViewConfigV1Schema.safeParse(raw);
  const legacy = v1.success ? v1.data : {};
  const regions = base.regions ?? [];
  const departments = base.departments ?? [];
  const region = base.region ?? legacy.region;
  return {
    version: 2,
    section: base.section ?? legacy.section ?? DEFAULTS.section,
    group: base.group ?? legacy.group,
    sort: base.sort ?? legacy.sort,
    dir: base.dir ?? legacy.dir,
    region,
    queue: base.queue ?? legacy.queue,
    columns: base.columns ?? legacy.columns,
    density: base.density ?? legacy.density,
    regions: regions.length
      ? regions
      : region && region !== "all"
        ? [region]
        : [],
    departments,
  };
}

export function toBidScheduleViewConfigV2(
  config: Partial<BidScheduleViewConfigV2> & { region?: string }
): BidScheduleViewConfigV2 {
  return parseBidScheduleViewConfig({ version: 2, ...config });
}
