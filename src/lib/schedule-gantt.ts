const DAY_MS = 86_400_000;

export const GANTT_LANE_PX = 28;
export const GANTT_MIN_BAR_PCT = 8;

export function utcStamp(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getTime();
}

export function ganttRange(
  timestamps: number[],
  today = new Date(),
  padDays = 10
): { start: number; end: number; span: number } {
  const fallback = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const min = timestamps.length ? Math.min(...timestamps) : fallback;
  const max = timestamps.length
    ? Math.max(...timestamps)
    : fallback + 31 * DAY_MS;
  const pad = padDays * DAY_MS;
  const start = min - pad;
  const end = max + pad;
  return { start, end, span: Math.max(end - start, DAY_MS) };
}

export function ganttBarRect(
  barStart: number,
  barEnd: number,
  rangeStart: number,
  span: number,
  minPct = GANTT_MIN_BAR_PCT
): { left: number; width: number } {
  const left = Math.max(0, ((barStart - rangeStart) / span) * 100);
  const raw = Math.max(0, ((barEnd - barStart) / span) * 100);
  const width = Math.max(minPct, raw);
  const maxLeft = Math.max(0, 100 - width);
  return {
    left: Math.min(left, maxLeft),
    width: Math.min(width, 100 - Math.min(left, maxLeft)),
  };
}

export function ganttMonthTicks(
  rangeStart: number,
  rangeEnd: number
): { left: number; label: string }[] {
  const span = rangeEnd - rangeStart;
  if (span <= 0) return [];
  const ticks: { left: number; label: string }[] = [];
  const cursor = new Date(rangeStart);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  if (cursor.getTime() < rangeStart) {
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  while (cursor.getTime() <= rangeEnd) {
    const at = cursor.getTime();
    ticks.push({
      left: ((at - rangeStart) / span) * 100,
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return ticks;
}

export function ganttTodayLeft(
  rangeStart: number,
  span: number,
  now = Date.now()
): number | null {
  if (now < rangeStart || now > rangeStart + span) return null;
  return ((now - rangeStart) / span) * 100;
}
