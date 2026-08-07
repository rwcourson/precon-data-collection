import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateBearer, requireScopes } from "@/lib/api-auth";

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(500),
});

const ALLOWED_FIELDS = [
  "region",
  "preconDepartment",
  "marketSector",
  "estimatePhase",
  "bidYear",
  "status",
  "outcome",
  "estimateValue",
] as const;

/**
 * Schema-aware view suggestion. Never writes — caller must review/save.
 */
export async function POST(req: Request) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = requireScopes(auth.token, "read:dashboards");
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const prompt = parsed.data.prompt.toLowerCase();
  const groupBy = ALLOWED_FIELDS.find((f) => prompt.includes(f.toLowerCase())) ?? "region";
  const metricKey = prompt.includes("fee") ? "feeExpected" : "estimateValue";

  return NextResponse.json({
    suggestion: {
      name: `Suggested: ${groupBy} × ${metricKey}`,
      scope: "personal",
      widgets: [
        {
          title: `${metricKey} by ${groupBy}`,
          kind: "bar",
          metricKey,
          groupBy,
        },
      ],
    },
    allowlistedFields: ALLOWED_FIELDS,
    requiresHumanSave: true,
  });
}
