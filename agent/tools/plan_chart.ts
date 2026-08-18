import { defineTool } from "eve/tools";
import { z } from "zod";
import { callAppTool, sessionAuth } from "../lib/app-bridge";

export default defineTool({
  description:
    "Build a dashboard/chart spec from a natural-language request. The UI renders the widgets; return the spec as-is.",
  inputSchema: z.object({
    intent: z.string().min(2).max(500),
  }),
  async execute(input, ctx) {
    return callAppTool("plan_chart", input, sessionAuth(ctx));
  },
});
