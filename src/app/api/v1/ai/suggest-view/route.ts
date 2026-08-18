import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_MODEL_ID } from "@/lib/ai/gateway";
import { authenticateBearer, requireScopes } from "@/lib/api-auth";
import { planDashboardWithOptionalLlm } from "@/lib/dashboard-copilot";

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(500),
});

/**
 * Schema-aware view suggestion via Claude Opus 5 + ZDR.
 * Never writes — caller must review/save.
 */
export async function POST(req: Request) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = requireScopes(auth.token, "read:dashboards");
  if (!scope.ok)
    return NextResponse.json({ error: scope.error }, { status: scope.status });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const plan = await planDashboardWithOptionalLlm(parsed.data.prompt);

  return NextResponse.json({
    suggestion: {
      name: plan.name,
      description: plan.description,
      scope: plan.scope,
      widgets: plan.widgets,
      rationale: plan.rationale,
      engine: plan.engine,
      model: AI_MODEL_ID,
      zeroDataRetention: true,
    },
    requiresHumanSave: true,
  });
}
