import "server-only";
import { and, inArray, isNull, like } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";

export async function revokeDemoSessionTokens(options: {
  apply: boolean;
  now?: Date;
  namePrefix?: string;
}) {
  const prefix = options.namePrefix ?? "mobile-demo-session:";
  const rows = await db
    .select({ id: apiTokens.id })
    .from(apiTokens)
    .where(
      and(like(apiTokens.name, `${prefix}%`), isNull(apiTokens.revokedAt))
    );
  if (options.apply && rows.length > 0) {
    await db
      .update(apiTokens)
      .set({ revokedAt: options.now ?? new Date() })
      .where(
        inArray(
          apiTokens.id,
          rows.map((row) => row.id)
        )
      );
  }
  return {
    mode: options.apply ? ("apply" as const) : ("dry-run" as const),
    matched: rows.length,
  };
}
