import { NextResponse } from "next/server";
import { createDataSnapshot } from "@/lib/recovery";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const periodKey = new Date().toISOString().slice(0, 10);
  const snap = await createDataSnapshot(periodKey);
  return NextResponse.json({ ok: true, ...snap, periodKey });
}
