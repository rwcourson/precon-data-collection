import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { getArtifactStorage } from "@/lib/artifact-storage";

/**
 * Email delivery (BRD Sections 4, 18). Messages land in a durable outbox first.
 * Stub/local mode records `previewed` and never sets `sentAt`. Resend mode
 * attaches real PDF bytes when an artifact storage key is present.
 */

export type QueuedEmail = {
  toEmail: string;
  toUserId?: number | null;
  subject: string;
  body: string;
  kind: "submitted" | "reminder" | "report_pdf" | "report_schedule";
  roundId?: number | null;
  distributionListId?: number | null;
  reportKey?: string | null;
  attachmentName?: string | null;
  attachmentStorageKey?: string | null;
  logicalDeliveryKey?: string | null;
};

export function emailProvider(): "resend" | "stub" {
  return getRuntimeConfig().email.mode;
}

export async function queueEmails(messages: QueuedEmail[]): Promise<number[]> {
  if (messages.length === 0) return [];
  const rows = await db
    .insert(emailOutbox)
    .values(
      messages.map((m) => ({
        toEmail: m.toEmail,
        toUserId: m.toUserId ?? null,
        subject: m.subject,
        body: m.body,
        kind: m.kind,
        roundId: m.roundId ?? null,
        distributionListId: m.distributionListId ?? null,
        reportKey: m.reportKey ?? null,
        attachmentName: m.attachmentName ?? null,
        attachmentStorageKey: m.attachmentStorageKey ?? null,
        logicalDeliveryKey: m.logicalDeliveryKey ?? null,
        provider: emailProvider(),
        status: "queued",
      })),
    )
    .returning({ id: emailOutbox.id });
  return rows.map((row) => row.id);
}

export async function deliverQueued(ids: number[]): Promise<{ sent: number; previewed: number; failed: number }> {
  const config = getRuntimeConfig();
  let sent = 0;
  let previewed = 0;
  let failed = 0;

  for (const id of ids) {
    const [claimed] = await db
      .update(emailOutbox)
      .set({
        status: "claimed",
        attemptCount: sql`${emailOutbox.attemptCount} + 1`,
      })
      .where(
        and(
          eq(emailOutbox.id, id),
          or(eq(emailOutbox.status, "queued"), eq(emailOutbox.status, "failed")),
        ),
      )
      .returning();
    if (!claimed) continue;

    if (config.email.mode === "stub") {
      await db
        .update(emailOutbox)
        .set({ status: "previewed", sentAt: null, error: null })
        .where(eq(emailOutbox.id, id));
      previewed += 1;
      continue;
    }

    const email = config.email;
    try {
      const attachments: { filename: string; content: string }[] = [];
      if (claimed.attachmentStorageKey && claimed.attachmentName) {
        const bytes = await getArtifactStorage().get(claimed.attachmentStorageKey);
        if (bytes) {
          attachments.push({
            filename: claimed.attachmentName,
            content: Buffer.from(bytes).toString("base64"),
          });
        }
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${email.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key":
            claimed.logicalDeliveryKey ?? `outbox-${claimed.id}-${claimed.attemptCount}`,
        },
        body: JSON.stringify({
          from: email.from,
          to: claimed.toEmail,
          subject: claimed.subject,
          text: claimed.body,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      await db
        .update(emailOutbox)
        .set({
          status: "sent",
          sentAt: new Date(),
          providerMessageId: body.id ?? null,
          error: null,
        })
        .where(eq(emailOutbox.id, id));
      sent += 1;
    } catch (e) {
      await db
        .update(emailOutbox)
        .set({
          status: "failed",
          error: e instanceof Error ? e.message : "Unknown error",
          nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
        })
        .where(eq(emailOutbox.id, id));
      failed += 1;
    }
  }

  return { sent, previewed, failed };
}

export async function sendEmails(messages: QueuedEmail[]): Promise<number> {
  const ids = await queueEmails(messages);
  await deliverQueued(ids);
  return ids.length;
}

export async function claimPendingOutbox(limit = 50): Promise<number[]> {
  const rows = await db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(
      or(
        eq(emailOutbox.status, "queued"),
        and(eq(emailOutbox.status, "failed"), isNull(emailOutbox.sentAt)),
      ),
    )
    .limit(limit);
  return rows.map((row) => row.id);
}
