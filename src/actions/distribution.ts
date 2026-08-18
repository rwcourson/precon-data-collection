"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { distributionLists } from "@/db/schema";
import { distributionListSchema } from "@/domain/contracts";
import { DomainError } from "@/domain/errors";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { distributionService } from "@/services/distribution-service";
import { assertPrincipalCanDistribute } from "@/services/mutation-policy";

export async function upsertDistributionList(raw: unknown) {
  const principal = await getWebPrincipal();
  const input = distributionListSchema.parse(raw);
  assertPrincipalCanDistribute(principal, input.region ?? null);

  if (input.id) {
    const [existing] = await db
      .select()
      .from(distributionLists)
      .where(
        and(
          eq(distributionLists.id, input.id),
          isNull(distributionLists.deletedAt)
        )
      );
    if (!existing) throw DomainError.notFound("Distribution list not found");
    assertPrincipalCanDistribute(principal, existing.region);

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
      .where(
        and(
          eq(distributionLists.id, input.id),
          isNull(distributionLists.deletedAt)
        )
      );
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
      ownerId: principal.user.id,
    })
    .returning();
  revalidatePath("/admin");
  revalidatePath("/reports");
  return row.id;
}

export async function deleteDistributionList(id: number) {
  const principal = await getWebPrincipal();
  const [list] = await db
    .select()
    .from(distributionLists)
    .where(
      and(eq(distributionLists.id, id), isNull(distributionLists.deletedAt))
    );
  if (!list) throw DomainError.notFound("Distribution list not found");
  assertPrincipalCanDistribute(principal, list.region);
  await db
    .update(distributionLists)
    .set({ deletedAt: new Date() })
    .where(eq(distributionLists.id, id));
  revalidatePath("/admin");
}

/** One-click send: real PDF artifact + outbox delivery (previewed in stub mode). */
export async function sendDistributionNow(listId: number) {
  const principal = await getWebPrincipal();
  const result = await distributionService.sendListNow(principal, listId);
  revalidatePath("/admin");
  return result;
}

/** Idempotent weekly send via service principal (no interactive cookie). */
export async function runDueDistributions(now = new Date()) {
  return distributionService.runDueDistributions(now);
}
