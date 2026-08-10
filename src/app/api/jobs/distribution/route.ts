import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { distributionService } from "@/services/distribution-service";

/**
 * Weekly distribution scheduler. Secure with CRON_SECRET.
 * Stub mode previews only; failures that need retry return non-2xx.
 */
export async function POST(req: Request) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  try {
    const results = await distributionService.runDueDistributions();
    const failed = results.some((row) => row.failed);
    return NextResponse.json(
      {
        ok: !failed,
        runs: results.map((row) => ({
          listId: row.listId,
          periodKey: row.periodKey,
          skipped: row.skipped,
          failed: Boolean(row.failed),
        })),
      },
      { status: failed ? 502 : 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 502 },
    );
  }
}
