import "server-only";
import { db } from "@/db";
import { productEvents } from "@/db/schema";
import type { Principal } from "@/lib/authorization/types";

const ALLOWED_EVENTS = new Set([
  "approval.decided",
  "approval.requested",
  "change.acknowledged",
  "date.changed",
  "export.current_view",
  "lock.created",
  "lock.unlocked",
  "pursuit.created",
  "salesforce.suggestion",
  "warehouse.published",
  "warehouse.retracted",
  "resource.bar.future",
]);

export async function recordProductEvent(
  principal: Principal | null,
  event: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  if (!ALLOWED_EVENTS.has(event)) return;
  await db.insert(productEvents).values({
    event,
    userId: principal?.user.id ?? null,
    region:
      principal?.workspace.kind === "region"
        ? principal.workspace.region
        : (principal?.user.region ?? null),
    properties,
  });
}
