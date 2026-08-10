import { NextResponse } from "next/server";
import { ensureDbReady } from "@/db";
import { checkReadiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkReadiness(ensureDbReady);
  return NextResponse.json(result.body, { status: result.status });
}
