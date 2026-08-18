import { defineTool } from "eve/tools";
import { z } from "zod";
import { callAppTool, sessionAuth } from "../lib/app-bridge";

export default defineTool({
  description:
    "Upcoming efforts with no team assigned — the same phase-7 Needs staffing preset as Overview.",
  inputSchema: z.object({
    regions: z.array(z.string()).optional(),
    departments: z.array(z.string()).optional(),
  }),
  async execute(input, ctx) {
    return callAppTool("query_needs_staffing", input, sessionAuth(ctx));
  },
});
