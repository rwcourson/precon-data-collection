import { NextRequest, NextResponse } from "next/server";
import { runDatabricksFeed } from "@/lib/integrations/databricks/feed";
import { authorizeCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Scheduler entry point for the warehouse feed (BRD Section 12).
 * Mutating writes only via POST with preview=0; GET is read-only preview.
 */
export async function POST(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;

  const previewOnly = req.nextUrl.searchParams.get("preview") !== "0";
  const result = await runDatabricksFeed({ previewOnly });
  // Never include raw business rows in scheduler responses.
  const { status, ...metrics } = result as { status: string } & Record<string, unknown>;
  const safe = {
    status,
    metrics: {
      rows: typeof metrics.rows === "number" ? metrics.rows : undefined,
      checksum: typeof metrics.checksum === "string" ? metrics.checksum : undefined,
      stage: typeof metrics.stage === "string" ? metrics.stage : undefined,
      error: typeof metrics.error === "string" ? metrics.error : undefined,
    },
  };
  return NextResponse.json(
    { ranAt: new Date().toISOString(), ...safe },
    { status: status === "failed" ? 502 : 200 },
  );
}

/** GET remains preview-only and non-mutating. */
export async function GET(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  const result = await runDatabricksFeed({ previewOnly: true });
  const { status, ...metrics } = result as { status: string } & Record<string, unknown>;
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    status,
    preview: true,
    metrics: {
      rows: typeof metrics.rows === "number" ? metrics.rows : undefined,
    },
  });
}
