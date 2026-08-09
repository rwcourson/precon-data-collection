import { createPursuit } from "@/actions/pursuits";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function POST(req: Request) {
  return withMobileAuth(req, async () => {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      const result = await createPursuit(body as Parameters<typeof createPursuit>[0]);
      return jsonOk({ data: result }, { status: 201 });
    } catch (err) {
      return mapError(err);
    }
  });
}
