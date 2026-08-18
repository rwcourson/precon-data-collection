import { desc, eq } from "drizzle-orm";
import { markAllNotificationsRead } from "@/actions/user";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "read:notifications" }, async () => {
    const user = await getCurrentUser();
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return jsonOk({
      data: rows,
      unread: rows.filter((n) => !n.readAt).length,
    });
  });
}

export async function POST(req: Request) {
  return withMobileAuth(req, { scopes: "write:notifications" }, async () => {
    try {
      await markAllNotificationsRead();
      return jsonOk({ ok: true });
    } catch (err) {
      return mapError(err);
    }
  });
}
