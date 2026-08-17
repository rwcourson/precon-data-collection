import { defineTool } from "eve/tools";
import { z } from "zod";
import { callAppTool, sessionAuth } from "../lib/app-bridge";

export default defineTool({
  description:
    "Search effort notes (round_notes) the caller can read. Returns excerpts plus job/round citations.",
  inputSchema: z.object({
    query: z.string().describe("Phrase to find in note bodies"),
  }),
  async execute(input, ctx) {
    return callAppTool("search_notes", input, sessionAuth(ctx));
  },
});
