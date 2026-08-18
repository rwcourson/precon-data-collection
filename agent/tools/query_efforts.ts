import { defineTool } from "eve/tools";
import { z } from "zod";
import { callAppTool, sessionAuth } from "../lib/app-bridge";

export default defineTool({
  description:
    "List visibility-scoped efforts (estimate rounds) with optional status, home region, department, or bid year filters.",
  inputSchema: z.object({
    status: z.string().optional(),
    homeRegion: z.string().optional(),
    department: z.string().optional(),
    bidYear: z.number().int().optional(),
  }),
  async execute(input, ctx) {
    return callAppTool("query_efforts", input, sessionAuth(ctx));
  },
});
