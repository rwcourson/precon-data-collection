import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";

/**
 * Email delivery (BRD Sections 4, 18). The notification channel is still an
 * open sponsor question, so every message is written to a visible outbox
 * first. If `RESEND_API_KEY` is present the queued message is also sent for
 * real; otherwise it stays a reviewable stub and nothing leaves the building.
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
};

export function emailProvider(): "resend" | "stub" {
  return process.env.RESEND_API_KEY ? "resend" : "stub";
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
        provider: emailProvider(),
      })),
    )
    .returning({ id: emailOutbox.id });
  return rows.map((r) => r.id);
}

/** Attempts delivery of queued messages; the stub provider marks them sent. */
export async function deliverQueued(ids: number[]): Promise<void> {
  const provider = emailProvider();
  for (const id of ids) {
    if (provider === "stub") {
      await db
        .update(emailOutbox)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(emailOutbox.id, id));
      continue;
    }
    const [message] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id));
    if (!message) continue;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "precon@brasfieldgorrie.com",
          to: message.toEmail,
          subject: message.subject,
          text: message.body,
        }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
      await db
        .update(emailOutbox)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(emailOutbox.id, id));
    } catch (e) {
      await db
        .update(emailOutbox)
        .set({ status: "failed", error: e instanceof Error ? e.message : "Unknown error" })
        .where(eq(emailOutbox.id, id));
    }
  }
}

export async function sendEmails(messages: QueuedEmail[]): Promise<number> {
  const ids = await queueEmails(messages);
  await deliverQueued(ids);
  return ids.length;
}
