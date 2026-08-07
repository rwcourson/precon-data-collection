"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reportTemplates, type ExportTemplateConfig } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";

export async function saveReportTemplate(name: string, config: ExportTemplateConfig) {
  const user = await getCurrentUser();
  if (!name.trim()) throw new Error("Template name is required");
  await db.insert(reportTemplates).values({
    name: name.trim(),
    ownerId: user.id,
    config,
  });
  revalidatePath("/bid-schedule");
}

export async function deleteReportTemplate(id: number) {
  const user = await getCurrentUser();
  const [tpl] = await db.select().from(reportTemplates).where(eq(reportTemplates.id, id));
  if (!tpl) return;
  if (tpl.ownerId !== user.id) throw new Error("Templates are personal — only the owner can delete");
  await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
  revalidatePath("/bid-schedule");
}
