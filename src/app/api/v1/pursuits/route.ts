import { NextResponse } from "next/server";
import { isNull } from "drizzle-orm";
import { db } from "@/db";
import { estimateRounds, jobs } from "@/db/schema";
import { authenticateBearer, requireScopes } from "@/lib/api-auth";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = requireScopes(auth.token, "read:pursuits");
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const rows = await db
    .select({
      jobId: jobs.id,
      jobNumber: jobs.jobNumber,
      jobName: jobs.jobName,
      region: jobs.region,
      roundId: estimateRounds.id,
      status: estimateRounds.status,
      estimatePhase: estimateRounds.estimatePhase,
      estimateValue: estimateRounds.estimateValue,
      outcome: estimateRounds.outcome,
    })
    .from(estimateRounds)
    .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
    .where(isNull(estimateRounds.deletedAt));

  const allow = auth.token.regionAllowlist ?? [];
  const filtered =
    allow.length === 0 ? rows : rows.filter((r) => allow.includes(r.region));

  return NextResponse.json({ data: filtered, count: filtered.length });
}
