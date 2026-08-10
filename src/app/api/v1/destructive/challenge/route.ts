import { NextResponse } from "next/server";
import { authenticateBearer, requireScopes } from "@/lib/api-auth";
import { createDestructiveChallenge } from "@/lib/api-safety";

export async function POST(req: Request) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = requireScopes(auth.token, "write:destructive");
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const body = (await req.json().catch(() => ({}))) as {
    operation?: string;
    target?: string;
    payload?: unknown;
  };
  if (!body.operation || !body.target) {
    return NextResponse.json({ error: "operation and target are required" }, { status: 400 });
  }

  const { challenge, expiresAt } = await createDestructiveChallenge({
    token: auth.token,
    operation: body.operation,
    target: body.target,
    payload: body.payload ?? null,
  });

  return NextResponse.json({
    challenge,
    expiresAt: expiresAt.toISOString(),
    note: "Pass X-Destructive-Challenge on the mutating request. One-time use.",
  });
}
