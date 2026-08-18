/** ISO-like week key used for weekly distribution cadence dedupe. */
export function weekPeriodKey(date: Date, timezone: string): string {
  // Resolve the calendar day in the list's timezone (a Sunday-evening send in
  // Chicago must not key to Monday's UTC week), then run ISO week math on it.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const d = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedDateParts(
  now: Date,
  timeZone: string
): { date: string; weekday: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday ?? "Sun"] ?? 0,
    hour: Number(parts.hour),
  };
}

/** Idempotency key for a self-serve report schedule fire. */
export function schedulePeriodKey(
  now: Date,
  timeZone: string,
  weekday: number,
  hour: number
): string {
  const parts = zonedDateParts(now, timeZone);
  return `${parts.date}-${weekday}-${String(hour).padStart(2, "0")}`;
}

export function isScheduleDue(
  now: Date,
  timeZone: string,
  weekday: number,
  hour: number
): boolean {
  const parts = zonedDateParts(now, timeZone);
  return parts.weekday === weekday && parts.hour === hour;
}
