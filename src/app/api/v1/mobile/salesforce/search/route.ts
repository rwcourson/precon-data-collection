import { searchSalesforceJobs } from "@/actions/pursuits";
import { jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "integrate:connect" }, async () => {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    try {
      const data = await searchSalesforceJobs(q);
      return jsonOk({ data });
    } catch (err) {
      return mapError(err);
    }
  });
}
