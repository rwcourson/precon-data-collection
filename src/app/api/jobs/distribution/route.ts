import { NextResponse } from "next/server";
import { runDueDistributions } from "@/actions/distribution";

/**
 * Weekly distribution scheduler. Secure with CRON_SECRET.
 * Missing email credentials never 500 — stub provider queues as sent.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const results = await runDueDistributions();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 200 },
    );
  }
}
