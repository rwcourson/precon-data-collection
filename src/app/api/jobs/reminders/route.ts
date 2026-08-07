import { NextRequest, NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Scheduler entry point for the reminder cadence — point a cron (Vercel Cron,
 * Windows Task Scheduler, or the B&G job runner) at this route. When
 * `CRON_SECRET` is set the caller must present it as a bearer token.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await runReminderSweep();
  return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
