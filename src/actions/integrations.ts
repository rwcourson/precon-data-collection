"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { runDatabricksFeed, type FeedResult } from "@/lib/integrations/databricks/feed";
import { probeDatabricksTables } from "@/lib/integrations/databricks/read";
import { listPreconSheets } from "@/lib/integrations/smartsheet/pull";
import { assertPrincipalAdmin } from "@/services/mutation-policy";

export async function runWarehouseFeed(previewOnly: boolean): Promise<FeedResult> {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "integrations", "manage", "Warehouse feed");
  const user = principal.user;

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
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "integrations", "manage", "Databricks probe");
  const user = principal.user;

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
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "integrations", "manage", "Smartsheet probe");
  const user = principal.user;

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
