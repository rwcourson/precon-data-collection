import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { createDataSnapshot } from "@/lib/recovery";

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
