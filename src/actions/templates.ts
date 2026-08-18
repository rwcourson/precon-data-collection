"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { type ExportTemplateConfig, reportTemplates } from "@/db/schema";
import { getWebPrincipal } from "@/lib/authorization/web-principal";

export async function saveReportTemplate(
  name: string,
  config: ExportTemplateConfig
) {
  const principal = await getWebPrincipal();
  if (!name.trim()) throw new Error("Template name is required");
  await db.insert(reportTemplates).values({
    name: name.trim(),
    ownerId: principal.user.id,
    config,
  });
  revalidatePath("/bid-schedule");
}

export async function deleteReportTemplate(id: number) {
  const principal = await getWebPrincipal();
  const [tpl] = await db
    .select()
    .from(reportTemplates)
    .where(eq(reportTemplates.id, id));
  if (!tpl) return;
  if (tpl.ownerId !== principal.user.id)
    throw new Error("Templates are personal — only the owner can delete");
  await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
  revalidatePath("/bid-schedule");
}
