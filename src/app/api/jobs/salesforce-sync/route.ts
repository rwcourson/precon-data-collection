import { NextResponse } from "next/server";
import { runSalesforceSync } from "@/actions/salesforce-inbox";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    // Cron path bypasses interactive user — use a service-style call by
    // temporarily relying on demo auth cookie when present; otherwise report.
    const result = await runSalesforceSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 200 },
    );
  }
}
