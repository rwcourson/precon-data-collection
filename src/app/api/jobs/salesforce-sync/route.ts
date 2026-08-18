import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { createServicePrincipal } from "@/services/distribution-service";
import { salesforceSyncService } from "@/services/salesforce-sync-service";

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as { cursor?: string | null };
    const result = await salesforceSyncService.runIncremental(createServicePrincipal(null), {
      cursor: body.cursor ?? null,
    });
    return NextResponse.json({ ok: true, runId: result.runId, metrics: {
      opportunitiesSeen: result.opportunitiesSeen,
      candidatesCreated: result.candidatesCreated,
      nextCursor: result.nextCursor,
    } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 502 },
    );
  }
}
