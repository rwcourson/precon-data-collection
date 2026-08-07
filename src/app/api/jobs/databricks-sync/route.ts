import { NextRequest, NextResponse } from "next/server";
import { runDatabricksFeed } from "@/lib/integrations/databricks/feed";

export const dynamic = "force-dynamic";

/**
 * Scheduler entry point for the warehouse feed (BRD Section 12). Protected by
 * `CRON_SECRET` when set, like the reminder sweep. `?preview=1` builds the
 * payload without writing, which is how the feed is exercised before B&G
 * issues warehouse credentials.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Default preview-only — warehouse writes require DATABRICKS_ALLOW_WRITE=true
  // and an explicit push (preview≠1). Production is read/pull only.
  const previewOnly = req.nextUrl.searchParams.get("preview") !== "0";
  const result = await runDatabricksFeed({ previewOnly });
  return NextResponse.json(
    { ranAt: new Date().toISOString(), ...result },
    { status: result.status === "failed" ? 502 : 200 },
  );
}

export async function GET(req: NextRequest) {
  return POST(req);
}
