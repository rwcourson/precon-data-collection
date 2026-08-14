"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bidScheduleViews,
  type BidScheduleView,
  type BidScheduleViewConfig,
} from "@/db/schema";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { principalRegionPredicate } from "@/lib/authorization/loaders";

export type BidScheduleViewRow = Pick<
  BidScheduleView,
  "id" | "name" | "ownerId" | "region" | "shared" | "config"
>;

export async function listBidScheduleViews(): Promise<BidScheduleViewRow[]> {
  const principal = await getWebPrincipal();
  return db
    .select({
      id: bidScheduleViews.id,
      name: bidScheduleViews.name,
      ownerId: bidScheduleViews.ownerId,
      region: bidScheduleViews.region,
      shared: bidScheduleViews.shared,
      config: bidScheduleViews.config,
    })
    .from(bidScheduleViews)
    .where(
      or(
        eq(bidScheduleViews.ownerId, principal.user.id),
        and(
          eq(bidScheduleViews.shared, true),
          principalRegionPredicate(bidScheduleViews.region, principal, true),
        ),
      ),
    );
}

export async function saveBidScheduleView(
  name: string,
  config: BidScheduleViewConfig,
  shared: boolean,
) {
  const principal = await getWebPrincipal();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("View name is required");

  const region = shared
    ? principal.workspace.kind === "region"
      ? principal.workspace.region
      : principal.user.region
    : null;

  await db.insert(bidScheduleViews).values({
    name: trimmed,
    ownerId: principal.user.id,
    region,
    shared,
    config,
  });
  revalidatePath("/bid-schedule");
}

export async function deleteBidScheduleView(id: number) {
  const principal = await getWebPrincipal();
  const [view] = await db
    .select()
    .from(bidScheduleViews)
    .where(
      and(eq(bidScheduleViews.id, id), eq(bidScheduleViews.ownerId, principal.user.id)),
    );
  if (!view) {
    throw new Error("Only the owner can delete a saved view");
  }
  await db
    .delete(bidScheduleViews)
    .where(and(eq(bidScheduleViews.id, id), eq(bidScheduleViews.ownerId, principal.user.id)));
  revalidatePath("/bid-schedule");
}
