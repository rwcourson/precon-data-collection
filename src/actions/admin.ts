"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  customColumns,
  referenceListValues,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import {
  canManageCompanyColumns,
  canManageReferenceLists,
  canManageRegionColumns,
} from "@/lib/permissions";

export async function addReferenceValue(listKey: string, value: string) {
  const user = await getCurrentUser();
  if (!canManageReferenceLists(user))
    throw new Error("Only the Corporate Precon Admin manages company-wide reference lists");
  if (!value.trim()) throw new Error("Value is required");

  const existing = await db
    .select()
    .from(referenceListValues)
    .where(eq(referenceListValues.listKey, listKey));
  if (existing.some((v) => v.value.toLowerCase() === value.trim().toLowerCase()))
    throw new Error("That value already exists in the list");

  await db.insert(referenceListValues).values({
    listKey,
    value: value.trim(),
    sortOrder: Math.max(0, ...existing.map((v) => v.sortOrder)) + 1,
  });
  await db.insert(auditLog).values({
    entity: "reference_list",
    action: "value_added",
    field: listKey,
    newValue: value.trim(),
    userId: user.id,
  });
  revalidatePath("/admin");
}

export async function setReferenceValueRetired(id: number, retired: boolean) {
  const user = await getCurrentUser();
  if (!canManageReferenceLists(user))
    throw new Error("Only the Corporate Precon Admin manages company-wide reference lists");

  const [row] = await db
    .select()
    .from(referenceListValues)
    .where(eq(referenceListValues.id, id));
  if (!row) throw new Error("Value not found");

  await db
    .update(referenceListValues)
    .set({ retired })
    .where(eq(referenceListValues.id, id));
  // Historical records retain the original value (BRD Section 10) — retiring
  // only removes it from new-entry dropdowns.
  await db.insert(auditLog).values({
    entity: "reference_list",
    action: retired ? "value_retired" : "value_restored",
    field: row.listKey,
    oldValue: row.value,
    newValue: retired ? "retired" : "active",
    userId: user.id,
  });
  revalidatePath("/admin");
}

export type AddColumnInput = {
  label: string;
  type: "text" | "number" | "dollars" | "date" | "dropdown";
  options?: string[];
  scope: "company" | "region";
  region?: string;
  preconDepartment?: string;
};

export async function addCustomColumn(input: AddColumnInput) {
  const user = await getCurrentUser();

  if (input.scope === "company") {
    if (!canManageCompanyColumns(user))
      throw new Error("Only the Corporate Precon Admin can add company-wide columns");
  } else {
    if (!canManageRegionColumns(user))
      throw new Error("Only RPDs (own Region) and the Corporate Admin can add Region columns");
    if (user.role === "rpd" && input.region !== user.region)
      throw new Error("RPDs can only add columns scoped to their own Region");
    if (!input.region) throw new Error("Region is required for Region-scoped columns");
  }
  if (!input.label.trim()) throw new Error("Column label is required");
  if (input.type === "dropdown" && (!input.options || input.options.length === 0))
    throw new Error("Dropdown columns need at least one option");

  const key = input.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const [col] = await db
    .insert(customColumns)
    .values({
      scope: input.scope,
      region: input.scope === "region" ? input.region : null,
      preconDepartment: input.scope === "region" ? (input.preconDepartment ?? null) : null,
      key,
      label: input.label.trim(),
      type: input.type,
      options: input.type === "dropdown" ? input.options : null,
      createdById: user.id,
    })
    .returning();

  await db.insert(auditLog).values({
    entity: "schema",
    entityId: col.id,
    action: "column_added",
    field: col.label,
    newValue: input.scope === "company" ? "company-wide" : `region:${input.region}`,
    userId: user.id,
  });
  revalidatePath("/admin");
  revalidatePath("/reports");
}

export async function deleteCustomColumn(id: number) {
  const user = await getCurrentUser();
  const [col] = await db.select().from(customColumns).where(eq(customColumns.id, id));
  if (!col) return;

  if (col.scope === "company") {
    if (!canManageCompanyColumns(user))
      throw new Error("Only the Corporate Precon Admin can delete company-wide columns");
  } else {
    if (user.role === "rpd" && col.region !== user.region)
      throw new Error("RPDs can only delete their own Region's columns");
    if (!canManageRegionColumns(user)) throw new Error("Not permitted");
  }

  await db.delete(customColumns).where(eq(customColumns.id, id));
  await db.insert(auditLog).values({
    entity: "schema",
    entityId: id,
    action: "column_deleted",
    field: col.label,
    oldValue: col.scope === "company" ? "company-wide" : `region:${col.region}`,
    userId: user.id,
  });
  revalidatePath("/admin");
  revalidatePath("/reports");
}
