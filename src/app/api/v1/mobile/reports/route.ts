import {
  deleteReport,
  runReport,
  saveReport,
  shareReport,
} from "@/actions/reports";
import { db } from "@/db";
import { savedReports, type SavedReportConfig } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { CONSOLIDATED_REGIONAL_PRESET } from "@/lib/report-presets";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import { desc, eq } from "drizzle-orm";

export async function GET(req: Request) {
  return withMobileAuth(req, async () => {
    const user = await getCurrentUser();
    const mine = await db
      .select()
      .from(savedReports)
      .where(eq(savedReports.ownerId, user.id))
      .orderBy(desc(savedReports.updatedAt));
    return jsonOk({
      data: mine,
      presets: [CONSOLIDATED_REGIONAL_PRESET],
    });
  });
}

export async function POST(req: Request) {
  return withMobileAuth(req, async () => {
    let body: {
      action?: string;
      name?: string;
      config?: SavedReportConfig;
      id?: number;
      existingId?: number;
      sharedWithRegions?: string[];
      sharedWithUserIds?: number[];
    };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      if (body.action === "run" && body.config) {
        const result = await runReport(body.config);
        return jsonOk({
          result: {
            ...result,
            rowCount: result.rows?.length ?? 0,
          },
        });
      }
      if (body.action === "save" && body.name && body.config) {
        const id = await saveReport(body.name, body.config, body.existingId);
        return jsonOk({ id });
      }
      if (body.action === "delete" && body.id) {
        await deleteReport(body.id);
        return jsonOk({ ok: true });
      }
      if (body.action === "share" && body.id) {
        await shareReport(
          body.id,
          body.sharedWithRegions ?? [],
          body.sharedWithUserIds ?? [],
        );
        return jsonOk({ ok: true });
      }
      return jsonError("Unknown action", 400);
    } catch (err) {
      return mapError(err);
    }
  });
}
