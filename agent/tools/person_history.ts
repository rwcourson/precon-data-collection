import { defineTool } from "eve/tools";
import { z } from "zod";
import { callAppTool, sessionAuth } from "../lib/app-bridge";

export default defineTool({
  description:
    "Efforts a directory person worked in a calendar year, from estimateLead plus explicit staffing marks.",
  inputSchema: z.object({
    name: z.string().optional(),
    userId: z.number().int().optional(),
    year: z.number().int().min(2015).max(2040),
  }),
  async execute(input, ctx) {
    return callAppTool("person_history", input, sessionAuth(ctx));
  },
});
