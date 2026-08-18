import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import { pursuitService, type CreatePursuitInput } from "@/services/pursuit-service";

export async function POST(req: Request) {
  return withMobileAuth(req, { scopes: "write:pursuits" }, async (principal) => {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      const result = await pursuitService.createPursuit(
        principal.authorization,
        body as CreatePursuitInput,
      );
      if (result.kind === "duplicates") {
        return jsonError("Possible duplicate jobs", 409, { matches: result.matches });
      }
      return jsonOk({ data: { jobId: result.jobId, roundId: result.roundId } }, { status: 201 });
    } catch (err) {
      return mapError(err);
    }
  });
}
