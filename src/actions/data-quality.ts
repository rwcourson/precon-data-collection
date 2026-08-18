"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLog, dataQualityFlags } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { principalCanViewAudit } from "@/lib/authorization/decisions";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { syncDataQualityFlags } from "@/lib/data-quality-sync";
import { getRoundsWithJobs } from "@/lib/queries";
import { getWorkspace } from "@/lib/workspace-server";
import { assertPrincipalAdmin } from "@/services/mutation-policy";

async function requireQualityEditor() {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "quality", "edit", "Import review");
  return principal.user;
}

/** Region scoping is enforced on the server, not just hidden in the queue. */
async function assertInScope(roundId: number) {
  const workspace = await getWorkspace();
  if (!workspace.region) return;
  const rounds = await getRoundsWithJobs(workspace);
  if (!rounds.some((r) => r.round.id === roundId))
    throw new Error("That flag belongs to another Region's workspace.");
}

/**
 * Rebuilds the review queue from current data. Existing resolutions survive:
 * a flag that is still present keeps its resolved state and only has
 * `lastSeenAt` bumped, and flags that no longer reproduce are deleted.
 */
export async function rescanDataQuality(): Promise<{
  open: number;
  resolved: number;
  cleared: number;
}> {
  const user = await requireQualityEditor();

  const result = await syncDataQualityFlags();

  await db.insert(auditLog).values({
    entity: "import",
    action: "data_quality_rescan",
    field: "needs review",
    newValue: `${result.total} flags (${result.inserted} new, ${result.cleared} cleared)`,
    userId: user.id,
  });

  revalidatePath("/admin");
  return {
    open: result.open,
    resolved: result.resolved,
    cleared: result.cleared,
  };
}

export async function resolveFlag(id: number, note: string) {
  const user = await requireQualityEditor();

  const [flag] = await db
    .select()
    .from(dataQualityFlags)
    .where(eq(dataQualityFlags.id, id));
  if (!flag) throw new Error("Flag not found");
  await assertInScope(flag.roundId);

  await db
    .update(dataQualityFlags)
    .set({
      resolvedAt: new Date(),
      resolvedById: user.id,
      resolutionNote: note.trim() || null,
    })
    .where(eq(dataQualityFlags.id, id));

  await db.insert(auditLog).values({
    entity: "import",
    entityId: id,
    roundId: flag.roundId,
    action: "data_quality_reviewed",
    field: flag.field,
    oldValue: flag.value,
    newValue: note.trim() || "Confirmed as-is",
    userId: user.id,
  });

  revalidatePath("/admin");
}

/**
 * A migrated year can produce hundreds of identical flags — one column that a
 * Region never tracked, or one legacy spelling. Reviewing those one row at a
 * time is not realistic, so a whole field + issue group can be confirmed in a
 * single decision, recorded as one audit entry.
 */
export async function resolveGroup(
  field: string,
  kind: string,
  note: string
): Promise<{ resolved: number }> {
  const user = await requireQualityEditor();

  const open = await db
    .select({ id: dataQualityFlags.id, roundId: dataQualityFlags.roundId })
    .from(dataQualityFlags)
    .where(
      and(
        eq(dataQualityFlags.field, field),
        eq(dataQualityFlags.kind, kind),
        isNull(dataQualityFlags.resolvedAt)
      )
    );
  if (open.length === 0) return { resolved: 0 };

  // An RPD confirming a column must not clear another Region's rows.
  const workspace = await getWorkspace();
  const inScope = new Set(
    (await getRoundsWithJobs(workspace)).map((r) => r.round.id)
  );
  const ids = open.filter((f) => inScope.has(f.roundId)).map((f) => f.id);
  if (ids.length === 0) return { resolved: 0 };
  for (let i = 0; i < ids.length; i += 500) {
    await db
      .update(dataQualityFlags)
      .set({
        resolvedAt: new Date(),
        resolvedById: user.id,
        resolutionNote: note.trim() || "Confirmed as-is (bulk)",
      })
      .where(inArray(dataQualityFlags.id, ids.slice(i, i + 500)));
  }

  await db.insert(auditLog).values({
    entity: "import",
    action: "data_quality_reviewed_group",
    field,
    oldValue: kind,
    newValue: `${ids.length} flags — ${note.trim() || "Confirmed as-is"}`,
    userId: user.id,
  });

  revalidatePath("/admin");
  return { resolved: ids.length };
}

/**
 * Cutover policy: legacy rows are confirmed as-is in one action and only new
 * entries are reviewed from then on. Scoped to the caller's workspace so a
 * Region's decision does not sign off on another Region's history.
 */
export async function confirmLegacyBaseline(): Promise<{ resolved: number }> {
  const user = await requireQualityEditor();

  const workspace = await getWorkspace();
  const inScope = new Set(
    (await getRoundsWithJobs(workspace)).map((r) => r.round.id)
  );

  const open = await db
    .select({ id: dataQualityFlags.id, roundId: dataQualityFlags.roundId })
    .from(dataQualityFlags)
    .where(isNull(dataQualityFlags.resolvedAt));
  const ids = open.filter((f) => inScope.has(f.roundId)).map((f) => f.id);
  if (ids.length === 0) return { resolved: 0 };

  const note = `Legacy import baseline confirmed ${new Date().toISOString().slice(0, 10)}`;
  for (let i = 0; i < ids.length; i += 500) {
    await db
      .update(dataQualityFlags)
      .set({
        resolvedAt: new Date(),
        resolvedById: user.id,
        resolutionNote: note,
      })
      .where(inArray(dataQualityFlags.id, ids.slice(i, i + 500)));
  }

  await db.insert(auditLog).values({
    entity: "import",
    action: "data_quality_baseline_confirmed",
    field: workspace.region ?? "all regions",
    newValue: `${ids.length} flags confirmed as-is`,
    userId: user.id,
  });

  revalidatePath("/admin");
  return { resolved: ids.length };
}

export async function reopenFlag(id: number) {
  await requireQualityEditor();
  const [flag] = await db
    .select()
    .from(dataQualityFlags)
    .where(eq(dataQualityFlags.id, id));
  if (!flag) throw new Error("Flag not found");
  await assertInScope(flag.roundId);
  await db
    .update(dataQualityFlags)
    .set({ resolvedAt: null, resolvedById: null, resolutionNote: null })
    .where(eq(dataQualityFlags.id, id));
  revalidatePath("/admin");
}

export async function canTriageImports(): Promise<boolean> {
  const principal = await getWebPrincipal();
  try {
    assertPrincipalAdmin(principal, "quality", "edit", "Import review");
    return true;
  } catch (err) {
    if (err instanceof DomainError) return principalCanViewAudit(principal);
    throw err;
  }
}
