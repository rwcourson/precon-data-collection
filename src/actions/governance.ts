"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  customColumnValues,
  customColumns,
  fieldPromotions,
  sheetAcls,
} from "@/db/schema";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { assertPrincipalAdmin } from "@/services/mutation-policy";

export async function proposeFieldPromotion(columnId: number, note?: string) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "promotions", "edit", "Field promotion");
  const user = principal.user;
  const [col] = await db.select().from(customColumns).where(eq(customColumns.id, columnId));
  if (!col) throw new Error("Column not found");
  if (col.scope !== "region") throw new Error("Only region columns can be promoted");
  if (user.role === "rpd" && col.region !== user.region) {
    throw new Error("Permission denied: RPDs may only propose columns for their region.");
  }

  const companySameKey = await db
    .select()
    .from(customColumns)
    .where(and(eq(customColumns.scope, "company"), eq(customColumns.key, col.key)));

  let conflictSummary: string | null = null;
  if (companySameKey[0]) {
    const existing = companySameKey[0];
    if (existing.type !== col.type) {
      conflictSummary = `Key "${col.key}" already exists company-wide with type ${existing.type} (proposed ${col.type}).`;
    } else {
      conflictSummary = `Key "${col.key}" already exists company-wide — confirm will merge labels/options only if types match.`;
    }
  }

  const [row] = await db
    .insert(fieldPromotions)
    .values({
      customColumnId: col.id,
      status: "proposed",
      proposedById: user.id,
      note: note?.trim() || null,
      conflictSummary,
    })
    .returning();

  await db.insert(auditLog).values({
    entity: "field_promotion",
    entityId: row.id,
    action: "proposed",
    field: col.key,
    newValue: col.label,
    userId: user.id,
  });
  revalidatePath("/admin");
  return { id: row.id, conflictSummary };
}

export async function reviewFieldPromotion(
  promotionId: number,
  decision: "promote" | "reject",
  reviewNote?: string,
) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "promotions", "manage", "Field promotion");
  const user = principal.user;
  const [promo] = await db
    .select()
    .from(fieldPromotions)
    .where(eq(fieldPromotions.id, promotionId));
  if (!promo || promo.status !== "proposed") throw new Error("Promotion not found or not open");

  const [col] = await db
    .select()
    .from(customColumns)
    .where(eq(customColumns.id, promo.customColumnId));
  if (!col) throw new Error("Source column missing");

  if (decision === "reject") {
    await db
      .update(fieldPromotions)
      .set({
        status: "rejected",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      })
      .where(eq(fieldPromotions.id, promotionId));
    await db.insert(auditLog).values({
      entity: "field_promotion",
      entityId: promotionId,
      action: "rejected",
      field: col.key,
      userId: user.id,
    });
    revalidatePath("/admin");
    return;
  }

  if (promo.conflictSummary?.includes("type")) {
    throw new Error(`Cannot promote: ${promo.conflictSummary}`);
  }

  const existing = await db
    .select()
    .from(customColumns)
    .where(and(eq(customColumns.scope, "company"), eq(customColumns.key, col.key)));

  let promotedId = existing[0]?.id;
  if (!promotedId) {
    const [created] = await db
      .insert(customColumns)
      .values({
        scope: "company",
        region: null,
        preconDepartment: null,
        key: col.key,
        label: col.label,
        type: col.type,
        options: col.options,
        createdById: user.id,
      })
      .returning();
    promotedId = created.id;

    // Point existing values at the company column
    await db
      .update(customColumnValues)
      .set({ columnId: promotedId })
      .where(eq(customColumnValues.columnId, col.id));
  }

  await db
    .update(fieldPromotions)
    .set({
      status: "promoted",
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || null,
      promotedColumnId: promotedId,
    })
    .where(eq(fieldPromotions.id, promotionId));

  await db.insert(auditLog).values({
    entity: "field_promotion",
    entityId: promotionId,
    action: "promoted",
    field: col.key,
    newValue: String(promotedId),
    userId: user.id,
  });
  revalidatePath("/admin");
  revalidatePath("/reports");
}

export async function setSheetAcl(input: {
  sheetId: number;
  userId?: number | null;
  grantRole?: "pcm" | "estimate_lead" | "admin_jsa" | "rpd" | "leadership" | "corporate_admin" | null;
  acl: "viewer" | "editor" | "manager";
  regionAllowlist?: string[];
}) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "promotions", "edit", "Sheet ACL");
  await db.insert(sheetAcls).values({
    sheetId: input.sheetId,
    userId: input.userId ?? null,
    grantRole: input.grantRole ?? null,
    acl: input.acl,
    regionAllowlist: input.regionAllowlist ?? [],
  });
  revalidatePath("/sheets");
  revalidatePath("/admin");
}
