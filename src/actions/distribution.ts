"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { distributionLists, distributionRuns, emailOutbox } from "@/db/schema";
import { distributionListSchema } from "@/domain/contracts";
import { getCurrentUser } from "@/lib/current-user";
import { deliverQueued, emailProvider } from "@/lib/email";
import { CONSOLIDATED_REGIONAL_PRESET_KEY, weekPeriodKey } from "@/lib/report-presets";

export async function upsertDistributionList(raw: unknown) {
  const user = await getCurrentUser();
  if (!["rpd", "corporate_admin", "admin_jsa"].includes(user.role)) {
    throw new Error("Permission denied: cannot manage distribution lists.");
  }
  const input = distributionListSchema.parse(raw);
  if (user.role === "rpd" && input.region && user.region && input.region !== user.region) {
    throw new Error("Permission denied: list region must match your region.");
  }

  if (input.id) {
    await db
      .update(distributionLists)
      .set({
        name: input.name,
        region: input.region,
        emails: input.emails,
        cadence: input.cadence,
        reportKey: input.reportKey,
        timezone: input.timezone,
        updatedAt: new Date(),
      })
      .where(and(eq(distributionLists.id, input.id), isNull(distributionLists.deletedAt)));
    revalidatePath("/admin");
    revalidatePath("/reports");
    return input.id;
  }

  const [row] = await db
    .insert(distributionLists)
    .values({
      name: input.name,
      region: input.region,
      emails: input.emails,
      cadence: input.cadence,
      reportKey: input.reportKey,
      timezone: input.timezone,
      ownerId: user.id,
    })
    .returning();
  revalidatePath("/admin");
  revalidatePath("/reports");
  return row.id;
}

export async function deleteDistributionList(id: number) {
  const user = await getCurrentUser();
  if (!["rpd", "corporate_admin"].includes(user.role)) {
    throw new Error("Permission denied.");
  }
  await db
    .update(distributionLists)
    .set({ deletedAt: new Date() })
    .where(eq(distributionLists.id, id));
  revalidatePath("/admin");
}

/** One-click send: queues one outbox row per recipient with PDF attachment metadata. */
export async function sendDistributionNow(listId: number) {
  const user = await getCurrentUser();
  if (!["rpd", "corporate_admin", "admin_jsa"].includes(user.role)) {
    throw new Error("Permission denied.");
  }
  const [list] = await db
    .select()
    .from(distributionLists)
    .where(and(eq(distributionLists.id, listId), isNull(distributionLists.deletedAt)));
  if (!list) throw new Error("Distribution list not found");

  const attachmentName = `${list.reportKey || CONSOLIDATED_REGIONAL_PRESET_KEY}.pdf`;
  const outboxIds: number[] = [];
  for (const email of list.emails) {
    const [row] = await db
      .insert(emailOutbox)
      .values({
        toEmail: email,
        subject: `${list.name} — Bid Schedule PDF`,
        body: `Attached: ${attachmentName}\n\nGenerated for ${list.name}.\nProvider: ${emailProvider()} (stub until SMTP credentials are configured).`,
        kind: "report_pdf",
        distributionListId: list.id,
        reportKey: list.reportKey,
        attachmentName,
        attachmentStorageKey: `reports/${list.reportKey}/${Date.now()}.pdf`,
        provider: emailProvider(),
      })
      .returning();
    outboxIds.push(row.id);
  }
  await deliverQueued(outboxIds);
  await db
    .update(distributionLists)
    .set({ lastSentAt: new Date(), updatedAt: new Date() })
    .where(eq(distributionLists.id, listId));
  revalidatePath("/admin");
  return { outboxIds, provider: emailProvider() };
}

/** Idempotent weekly send keyed by ISO week period. */
export async function runDueDistributions(now = new Date()) {
  const lists = await db
    .select()
    .from(distributionLists)
    .where(and(eq(distributionLists.cadence, "weekly"), isNull(distributionLists.deletedAt)));

  const results: { listId: number; periodKey: string; skipped: boolean }[] = [];
  for (const list of lists) {
    const periodKey = weekPeriodKey(now, list.timezone);
    if (list.lastPeriodKey === periodKey) {
      results.push({ listId: list.id, periodKey, skipped: true });
      continue;
    }
    const existing = await db
      .select()
      .from(distributionRuns)
      .where(
        and(
          eq(distributionRuns.distributionListId, list.id),
          eq(distributionRuns.periodKey, periodKey),
        ),
      );
    if (existing[0]) {
      results.push({ listId: list.id, periodKey, skipped: true });
      continue;
    }

    const { outboxIds } = await sendDistributionNow(list.id);
    await db.insert(distributionRuns).values({
      distributionListId: list.id,
      periodKey,
      status: "sent",
      outboxIds,
    });
    await db
      .update(distributionLists)
      .set({ lastPeriodKey: periodKey, lastSentAt: now })
      .where(eq(distributionLists.id, list.id));
    results.push({ listId: list.id, periodKey, skipped: false });
  }
  return results;
}
