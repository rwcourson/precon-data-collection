import { type NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runReminderSweep } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Scheduler entry point for the reminder cadence — point a cron (Vercel Cron,
 * Windows Task Scheduler, or the B&G job runner) at this route. When
 * The caller must present the configured scheduler bearer token.
 */
export async function POST(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  const result = await runReminderSweep();
  return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
