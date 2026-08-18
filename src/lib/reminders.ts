import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, type AppDb } from "@/db";
import { appSettings, notifications } from "@/db/schema";
import { fmtDate } from "./format";
import { sendEmails, type QueuedEmail } from "./email";
import {
  getMultiValuesForRounds,
  getRoundsWithJobs,
} from "./queries";
import { missingRequiredFields } from "./validation";

/**
 * Reminder cadence for rounds that reached Submitted but still have blank
 * required fields (BRD Sections 4, 18). Runs idempotently per cadence window
 * so re-invoking the sweep on the same day does not re-nag anyone.
 */

export const SETTINGS_KEY = "notifications";

export type Cadence = "off" | "daily" | "weekly";

export type NotificationSettings = {
  cadence: Cadence;
  /** Days after Submitted before the first reminder. */
  graceDays: number;
  /** Also notify the Region's RPD once a round is this many days overdue. */
  escalateAfterDays: number;
  email: boolean;
  inApp: boolean;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  cadence: "weekly",
  graceDays: 3,
  escalateAfterDays: 14,
  email: true,
  inApp: true,
};

/** Accepts an optional db/tx handle so callers inside a transaction reuse it. */
export async function getNotificationSettings(
  executor: AppDb = db,
): Promise<NotificationSettings> {
  const [row] = await executor.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY));
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<NotificationSettings>) };
}

export type ReminderTarget = {
  roundId: number;
  jobNumber: string;
  jobName: string;
  region: string;
  estimatePhase: string;
  submittedAt: Date | null;
  daysOverdue: number;
  missing: string[];
  recipients: { id: number; name: string; email: string | null; role: string }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Rounds that are due a nudge, with their recipients — no writes. */
export async function findReminderTargets(
  settings: NotificationSettings,
  now = new Date(),
): Promise<ReminderTarget[]> {
  const rows = await getRoundsWithJobs();
  const pending = rows.filter((r) => ["submitted", "post_bid"].includes(r.round.status));
  if (pending.length === 0) return [];

  const multiMap = await getMultiValuesForRounds(pending.map((r) => r.round.id));
  const allUsers = await db.query.users.findMany();
  const rpdByRegion = new Map(
    allUsers.filter((u) => u.role === "rpd").map((u) => [u.region ?? "", u]),
  );

  const targets: ReminderTarget[] = [];
  for (const { round, job } of pending) {
    const missing = missingRequiredFields(round, multiMap.get(round.id) ?? {}, {
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      estimateLeadName: round.estimateLeadId ? "assigned" : null,
    });
    if (missing.length === 0) continue;

    // Migrated Smartsheet rows have no submitted timestamp, so the bid due date
    // stands in for when the clock started; otherwise every legacy row would
    // look like it was submitted on import day.
    const since = round.submittedAt ?? parseDate(round.bidDueDate) ?? round.updatedAt;
    const daysOverdue = Math.floor((now.getTime() - since.getTime()) / DAY_MS);
    if (daysOverdue < settings.graceDays) continue;

    const recipients: ReminderTarget["recipients"] = [];
    const lead = allUsers.find((u) => u.id === round.estimateLeadId);
    const rpd = rpdByRegion.get(round.region);
    if (lead) recipients.push(lead);
    // An unassigned round still needs an owner, so the RPD hears about it
    // immediately rather than waiting for the escalation window.
    if ((!lead || daysOverdue >= settings.escalateAfterDays) && rpd && rpd.id !== lead?.id) {
      recipients.push(rpd);
    }
    if (recipients.length === 0) continue;

    targets.push({
      roundId: round.id,
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      region: round.region,
      estimatePhase: round.estimatePhase,
      submittedAt: round.submittedAt,
      daysOverdue,
      missing,
      recipients,
    });
  }
  return targets.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export type SweepResult = {
  cadence: Cadence;
  skipped: boolean;
  reason?: string;
  candidates: number;
  notified: number;
  emailed: number;
};

export async function runReminderSweep(opts: { force?: boolean } = {}): Promise<SweepResult> {
  const settings = await getNotificationSettings();
  const now = new Date();

  if (settings.cadence === "off" && !opts.force) {
    return { cadence: settings.cadence, skipped: true, reason: "Reminders are turned off.", candidates: 0, notified: 0, emailed: 0 };
  }

  const targets = await findReminderTargets(settings, now);
  const windowMs = settings.cadence === "daily" ? DAY_MS : 7 * DAY_MS;
  const windowStart = new Date(now.getTime() - windowMs);

  let notified = 0;
  const emails: QueuedEmail[] = [];

  for (const t of targets) {
    for (const person of t.recipients) {
      if (!opts.force && (await alreadyNudged(person.id, t.roundId, windowStart))) continue;

      const summary = `${t.missing.length} required field${t.missing.length === 1 ? "" : "s"} still blank on ${t.jobName} (#${t.jobNumber}, ${t.estimatePhase}).`;
      const detail = `Submitted ${fmtDate(t.submittedAt)} — ${t.daysOverdue} day${t.daysOverdue === 1 ? "" : "s"} ago. Outstanding: ${t.missing.slice(0, 8).join(", ")}${t.missing.length > 8 ? `, and ${t.missing.length - 8} more` : ""}.`;

      if (settings.inApp) {
        await db.insert(notifications).values({
          userId: person.id,
          title: "Post-bid data still incomplete",
          body: `${summary} ${detail}`,
          roundId: t.roundId,
        });
        notified++;
      }
      if (settings.email && person.email) {
        emails.push({
          toEmail: person.email,
          toUserId: person.id,
          subject: `Post-bid data reminder — ${t.jobName} (#${t.jobNumber})`,
          body: `${summary}\n\n${detail}\n\nOpen the round to finish entry: /rounds/${t.roundId}`,
          kind: "reminder",
          roundId: t.roundId,
        });
      }
    }
  }

  const emailed = await sendEmails(emails);
  return { cadence: settings.cadence, skipped: false, candidates: targets.length, notified, emailed };
}

/** Prevents a second nudge for the same round + person inside one cadence window. */
async function alreadyNudged(userId: number, roundId: number, since: Date): Promise<boolean> {
  const [recent] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.roundId, roundId),
        eq(notifications.title, "Post-bid data still incomplete"),
        gte(notifications.createdAt, since),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  return Boolean(recent);
}
