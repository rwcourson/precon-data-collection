import { NextResponse } from "next/server";
import { createDataSnapshot } from "@/lib/recovery";
import { authorizeCron } from "@/lib/cron-auth";

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  const periodKey = new Date().toISOString().slice(0, 10);
  const snap = await createDataSnapshot(periodKey);
  return NextResponse.json({ ok: true, ...snap, periodKey });
}
