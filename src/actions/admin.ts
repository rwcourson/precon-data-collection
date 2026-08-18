"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLog, customColumns, referenceListValues } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { authorize } from "@/lib/authorization/kernel";
import { principalAllowsRegion } from "@/lib/authorization/principal";
import type { Principal } from "@/lib/authorization/types";
import { getWebPrincipal } from "@/lib/authorization/web-principal";

function requireAdminManage(
  principal: Principal,
  section: string,
  region: string | null = null
) {
  const decision = authorize(principal, "manage", {
    type: "admin",
    id: section,
    region,
    ownerId: null,
    published: true,
    deleted: false,
    adminSection: section,
  });
  if (!decision.allowed) {
    // Corporate lists/columns require corporate manage; region columns use role+region checks below.
    if (section === "columns" && region != null) {
      if (!["rpd", "corporate_admin"].includes(principal.user.role)) {
        throw DomainError.forbidden("Not permitted to manage Region columns.");
      }
      if (!principalAllowsRegion(principal, region)) {
        throw DomainError.forbidden(
          "Not permitted to manage columns in that Region."
        );
      }
      return;
    }
    throw DomainError.forbidden("Not permitted to manage admin settings.");
  }
}

export async function addReferenceValue(listKey: string, value: string) {
  const principal = await getWebPrincipal();
  requireAdminManage(principal, "lists");
  if (!value.trim()) throw DomainError.badRequest("Value is required");

  const existing = await db
    .select()
    .from(referenceListValues)
    .where(eq(referenceListValues.listKey, listKey));
  if (
    existing.some((v) => v.value.toLowerCase() === value.trim().toLowerCase())
  )
    throw DomainError.badRequest("That value already exists in the list");

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
    userId: principal.user.id,
  });
  revalidatePath("/admin");
}

export async function setReferenceValueRetired(id: number, retired: boolean) {
  const principal = await getWebPrincipal();
  requireAdminManage(principal, "lists");

  const [row] = await db
    .select()
    .from(referenceListValues)
    .where(eq(referenceListValues.id, id));
  if (!row) throw DomainError.notFound("Value not found");

  await db
    .update(referenceListValues)
    .set({ retired })
    .where(eq(referenceListValues.id, id));
  await db.insert(auditLog).values({
    entity: "reference_list",
    action: retired ? "value_retired" : "value_restored",
    field: row.listKey,
    oldValue: row.value,
    newValue: retired ? "retired" : "active",
    userId: principal.user.id,
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
  const principal = await getWebPrincipal();
  const user = principal.user;

  if (input.scope === "company") {
    requireAdminManage(principal, "lists");
  } else {
    if (!input.region)
      throw DomainError.badRequest(
        "Region is required for Region-scoped columns"
      );
    requireAdminManage(principal, "columns", input.region);
  }
  if (!input.label.trim())
    throw DomainError.badRequest("Column label is required");
  if (
    input.type === "dropdown" &&
    (!input.options || input.options.length === 0)
  )
    throw DomainError.badRequest("Dropdown columns need at least one option");

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
      preconDepartment:
        input.scope === "region" ? (input.preconDepartment ?? null) : null,
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
    newValue:
      input.scope === "company" ? "company-wide" : `region:${input.region}`,
    userId: user.id,
  });
  revalidatePath("/admin");
  revalidatePath("/reports");
}

export async function deleteCustomColumn(id: number) {
  const principal = await getWebPrincipal();
  const [col] = await db
    .select()
    .from(customColumns)
    .where(eq(customColumns.id, id));
  if (!col) return;

  if (col.scope === "company") {
    requireAdminManage(principal, "lists");
  } else {
    requireAdminManage(principal, "columns", col.region);
  }

  await db.delete(customColumns).where(eq(customColumns.id, id));
  await db.insert(auditLog).values({
    entity: "schema",
    entityId: id,
    action: "column_deleted",
    field: col.label,
    oldValue: col.scope === "company" ? "company-wide" : `region:${col.region}`,
    userId: principal.user.id,
  });
  revalidatePath("/admin");
  revalidatePath("/reports");
}
