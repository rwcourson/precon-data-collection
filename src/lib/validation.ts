import type { EstimateRound } from "@/db/schema";
import {
  conditionContextFrom,
  FIELD_DEFS,
  inapplicableFieldKeys,
  isRateOnly,
  MULTI_FIELD_KEYS,
  REQUIRED_FIELD_KEYS,
} from "./fields";

/** Required keys that conditional logic currently keeps on the form. */
export function applicableRequiredKeys(round: EstimateRound): string[] {
  const hidden = new Set(
    inapplicableFieldKeys(conditionContextFrom(round as unknown as Record<string, unknown>)),
  );
  return REQUIRED_FIELD_KEYS.filter((k) => !hidden.has(k));
}

/**
 * Required-field completeness (BRD Section 7): $0 is acceptable, blank is not.
 * Returns the labels of required fields that are still blank.
 */
export function missingRequiredFields(
  round: EstimateRound,
  multiValues: Record<string, string[]>,
  extras: { jobNumber: string; jobName: string; estimateLeadName: string | null },
): string[] {
  const missing: string[] = [];
  for (const key of applicableRequiredKeys(round)) {
    const def = FIELD_DEFS.find((f) => f.key === key)!;
    if (key === "jobNumber") {
      if (!extras.jobNumber) missing.push(def.label);
      continue;
    }
    if (key === "jobName") {
      if (!extras.jobName) missing.push(def.label);
      continue;
    }
    if (key === "estimateLead") {
      if (!extras.estimateLeadName) missing.push(def.label);
      continue;
    }
    if (MULTI_FIELD_KEYS.includes(key)) {
      if (!multiValues[key] || multiValues[key].length === 0) missing.push(def.label);
      continue;
    }
    const value = (round as unknown as Record<string, unknown>)[key];
    if (value === null || value === undefined || value === "") missing.push(def.label);
  }
  return missing;
}

/** Percentage of required fields completed, for queue progress display. */
export function requiredCompletion(
  round: EstimateRound,
  multiValues: Record<string, string[]>,
  extras: { jobNumber: string; jobName: string; estimateLeadName: string | null },
): { done: number; total: number } {
  const missing = missingRequiredFields(round, multiValues, extras);
  const total = applicableRequiredKeys(round).length;
  return { done: total - missing.length, total };
}

/** Server-side format validation for a single field value. */
export function validateFieldValue(
  key: string,
  raw: string,
  lists: Record<string, string[]>,
): { ok: true; value: number | string | null } | { ok: false; error: string } {
  const def = FIELD_DEFS.find((f) => f.key === key);
  if (!def) return { ok: false, error: `Unknown field ${key}` };
  if (raw === "" || raw == null) return { ok: true, value: null };

  switch (def.type) {
    case "number":
    case "dollars": {
      const n = Number(String(raw).replace(/[$,\s]/g, ""));
      if (!isFinite(n)) return { ok: false, error: `${def.label} must be numeric` };
      return { ok: true, value: n };
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
        return { ok: false, error: `${def.label} must be a valid date` };
      return { ok: true, value: raw };
    }
    case "dropdown": {
      const listValues = def.listKey ? (lists[def.listKey] ?? []) : [];
      // No free-text override — must match the managed reference list
      if (listValues.length > 0 && !listValues.includes(raw))
        return { ok: false, error: `${def.label} must match a managed list value` };
      return { ok: true, value: raw };
    }
    default: {
      if (raw.length > 500) return { ok: false, error: `${def.label} exceeds length limit` };
      return { ok: true, value: raw };
    }
  }
}

export { isRateOnly };
