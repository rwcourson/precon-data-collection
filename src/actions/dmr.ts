"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { dmrImports, dmrLines } from "@/db/schema";
import {
  listRoundsWithJobsForPrincipal,
  loadAdminSectionForPrincipal,
  principalRegionPredicate,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { reconcileDmr } from "@/lib/dmr-reconcile";

export async function importDmrUpload(input: {
  name: string;
  periodKey?: string;
  lines: { jobNumber: string; jobName?: string; region?: string; dmrValue: number }[];
}) {
  const principal = await getWebPrincipal();
  if (!["corporate_admin", "rpd", "leadership"].includes(principal.user.role)) {
    throw new Error("Permission denied.");
  }
  const user = principal.user;
  const [imp] = await db
    .insert(dmrImports)
    .values({
      name: input.name,
      source: "upload",
      periodKey: input.periodKey ?? null,
      importedById: user.id,
    })
    .returning();

  if (input.lines.length) {
    await db.insert(dmrLines).values(
      input.lines.map((l) => ({
        importId: imp.id,
        jobNumber: l.jobNumber,
        jobName: l.jobName ?? null,
        region: l.region ?? null,
        dmrValue: l.dmrValue,
      })),
    );
  }
  revalidatePath("/dashboards/reconciliation");
  return imp.id;
}

export async function getDmrReconciliation(importId: number) {
  const principal = await getWebPrincipal();
  if (!(await loadAdminSectionForPrincipal(principal, "integrations"))) {
    throw new Error("Not found");
  }
  const lines = await db
    .select()
    .from(dmrLines)
    .where(
      and(
        eq(dmrLines.importId, importId),
        principalRegionPredicate(dmrLines.region, principal, true),
      ),
    );
  const rounds = await listRoundsWithJobsForPrincipal(principal);
  return reconcileDmr(
    lines.map((l) => ({
      jobNumber: l.jobNumber,
      jobName: l.jobName,
      region: l.region,
      dmrValue: l.dmrValue,
    })),
    rounds
      .filter((r) => r.round.estimateValue != null)
      .map((r) => ({
        jobNumber: r.job.jobNumber,
        jobName: r.job.jobName,
        region: r.round.region,
        preconValue: r.round.estimateValue ?? 0,
        roundId: r.round.id,
      })),
  );
}
