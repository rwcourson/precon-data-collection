"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { runDatabricksFeed, type FeedResult } from "@/lib/integrations/databricks/feed";
import { probeDatabricksTables } from "@/lib/integrations/databricks/read";
import { listPreconSheets } from "@/lib/integrations/smartsheet/pull";

export async function runWarehouseFeed(previewOnly: boolean): Promise<FeedResult> {
  const user = await getCurrentUser();
  if (user.role !== "corporate_admin")
    throw new Error("Only the Corporate Precon Admin can run the warehouse feed.");

  // Push still requires DATABRICKS_ALLOW_WRITE=true inside runDatabricksFeed.
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

export async function probeWarehouseRead() {
  const user = await getCurrentUser();
  if (user.role !== "corporate_admin")
    throw new Error("Only the Corporate Precon Admin can probe Databricks.");

  const result = await probeDatabricksTables();

  await db.insert(auditLog).values({
    entity: "integration",
    action: "databricks_read_probe",
    field: "databricks",
    newValue: result.configured
      ? `${result.tables.filter((t) => t.ok).length}/${result.tables.length} tables readable`
      : "not configured",
    userId: user.id,
  });

  revalidatePath("/admin");
  return result;
}

export async function probeSmartsheetRead() {
  const user = await getCurrentUser();
  if (user.role !== "corporate_admin")
    throw new Error("Only the Corporate Precon Admin can probe Smartsheet.");

  const result = await listPreconSheets();

  await db.insert(auditLog).values({
    entity: "integration",
    action: "smartsheet_read_probe",
    field: "smartsheet",
    newValue: result.configured
      ? `${result.sheets.length} precon sheets visible${result.userEmail ? ` (${result.userEmail})` : ""}`
      : "not configured",
    userId: user.id,
  });

  revalidatePath("/admin");
  return result;
}
