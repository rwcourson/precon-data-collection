"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { runDatabricksFeed, type FeedResult } from "@/lib/integrations/databricks/feed";

export async function runWarehouseFeed(previewOnly: boolean): Promise<FeedResult> {
  const user = await getCurrentUser();
  if (user.role !== "corporate_admin")
    throw new Error("Only the Corporate Precon Admin can run the warehouse feed.");

  const result = await runDatabricksFeed({ previewOnly });

  await db.insert(auditLog).values({
    entity: "integration",
    action: previewOnly ? "warehouse_feed_preview" : "warehouse_feed_run",
    field: result.table ?? "databricks",
    newValue: `${result.rows} rows — ${result.status}${result.error ? `: ${result.error}` : ""}`,
    userId: user.id,
  });

  revalidatePath("/admin");
  return result;
}
