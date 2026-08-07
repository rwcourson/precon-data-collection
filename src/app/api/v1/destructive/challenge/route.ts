import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiDestructiveChallenges } from "@/db/schema";
import { authenticateBearer, requireScopes } from "@/lib/api-auth";
import { generateDestructiveChallenge } from "@/lib/api-tokens";

export async function POST(req: Request) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = requireScopes(auth.token, "write:destructive");
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const body = (await req.json().catch(() => ({}))) as { operation?: string };
  if (!body.operation) {
    return NextResponse.json({ error: "operation required" }, { status: 400 });
  }

  const challenge = generateDestructiveChallenge();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await db.insert(apiDestructiveChallenges).values({
    tokenId: auth.token.id,
    challenge,
    operation: body.operation,
    expiresAt,
  });

  return NextResponse.json({
    challenge,
    expiresAt: expiresAt.toISOString(),
    note: "Pass X-Destructive-Challenge on the mutating request. One-time use.",
  });
}
