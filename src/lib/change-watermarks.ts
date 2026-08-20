export type ChangeAudit = {
  id: number;
  roundId: number | null;
  userId: number | null;
  field: string | null;
  oldValue?: string | null;
  newValue?: string | null;
};

export type RoundChangeSummary = {
  fields: string[];
  values: Record<string, { oldValue: string | null; newValue: string | null }>;
  latestAuditId: number;
  count: number;
};

/** One user's watermark never clears another user's highlights. */
export function summarizeChangesSinceWatermarks(
  audits: ChangeAudit[],
  viewerId: number,
  watermarkByRound: Map<number, number>
): Map<number, RoundChangeSummary> {
  const out = new Map<number, RoundChangeSummary>();
  for (const change of audits) {
    if (!change.roundId || change.userId === viewerId) continue;
    if (change.id <= (watermarkByRound.get(change.roundId) ?? 0)) continue;
    const current = out.get(change.roundId) ?? {
      fields: [],
      values: {},
      latestAuditId: change.id,
      count: 0,
    };
    if (change.field && !current.fields.includes(change.field))
      current.fields.push(change.field);
    if (change.field) {
      current.values[change.field] = {
        oldValue: change.oldValue ?? null,
        newValue: change.newValue ?? null,
      };
    }
    current.latestAuditId = Math.max(current.latestAuditId, change.id);
    current.count += 1;
    out.set(change.roundId, current);
  }
  return out;
}
