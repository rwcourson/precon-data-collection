import type { EstimateRound } from "@/db/schema";
import {
  conditionContextFrom,
  FIELD_DEFS,
  fieldAllowsNa,
  fieldRangeIssue,
  inapplicableFieldKeys,
  isRateOnly,
  MULTI_FIELD_KEYS,
  requiredFieldKeysFor,
} from "./fields";

export type FieldExceptionState = {
  notApplicable?: ReadonlySet<string>;
  rangeAcknowledged?: ReadonlySet<string>;
};

export function snapshotForException(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}

/** An N/A or range ack only applies while the stored value still matches. */
export function applicableExceptionKeys(
  snapshots: ReadonlyMap<string, string | null>,
  values: Record<string, unknown>
): Set<string> {
  const keys = new Set<string>();
  for (const [key, snapshot] of snapshots) {
    if (snapshot === snapshotForException(values[key])) keys.add(key);
  }
  return keys;
}

/** Required keys that conditional logic currently keeps on the form. */
export function applicableRequiredKeys(
  round: EstimateRound,
  options: { fieldPolicy?: boolean } = {}
): string[] {
  const ctx = conditionContextFrom(round as unknown as Record<string, unknown>);
  const hidden = new Set(inapplicableFieldKeys(ctx));
  return requiredFieldKeysFor(ctx, options).filter((key) => !hidden.has(key));
}

/**
 * Required-field completeness (BRD Section 7): $0 is acceptable, blank is not.
 * Returns the labels of required fields that are still blank.
 */
export function missingRequiredFields(
  round: EstimateRound,
  multiValues: Record<string, string[]>,
  extras: {
    jobNumber: string;
    jobName: string;
    estimateLeadName: string | null;
  },
  exceptions: FieldExceptionState = {},
  options: { fieldPolicy?: boolean } = {}
): string[] {
  const missing: string[] = [];
  const fieldPolicy = options.fieldPolicy === true;
  for (const key of applicableRequiredKeys(round, options)) {
    const def = FIELD_DEFS.find((f) => f.key === key)!;
    if (exceptions.notApplicable?.has(key) && fieldAllowsNa(def)) continue;
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
      if (!multiValues[key] || multiValues[key].length === 0)
        missing.push(def.label);
      continue;
    }
    const value = (round as unknown as Record<string, unknown>)[key];
    if (value === null || value === undefined || value === "")
      missing.push(def.label);
    else if (fieldPolicy && def.zeroInvalid && Number(value) === 0)
      missing.push(def.label);
    else if (
      fieldPolicy &&
      fieldRangeIssue(def, value) &&
      !exceptions.rangeAcknowledged?.has(key)
    )
      missing.push(def.label);
  }
  return missing;
}

/** Historical zeros stay stored; this queue lists them for human remediation. */
export function legacyZeroFieldLabels(round: EstimateRound): string[] {
  return FIELD_DEFS.filter((def) => def.zeroInvalid)
    .filter((def) => {
      const value = (round as unknown as Record<string, unknown>)[def.key];
      return value != null && Number(value) === 0;
    })
    .map((def) => def.label);
}

/** Shared lock gate used by RPD Approve & Lock. */
export function evaluateLockGate(
  round: EstimateRound,
  multiValues: Record<string, string[]>,
  extras: {
    jobNumber: string;
    jobName: string;
    estimateLeadName: string | null;
  },
  exceptions: FieldExceptionState = {},
  options: { fieldPolicy?: boolean } = {}
): { ok: true } | { ok: false; missingFields: string[]; error: string } {
  const missing = missingRequiredFields(
    round,
    multiValues,
    extras,
    exceptions,
    options
  );
  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    missingFields: missing,
    error: `Cannot lock — ${missing.length} required field${missing.length === 1 ? " is" : "s are"} blank, zero, or unacknowledged: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}`,
  };
}

/** Percentage of required fields completed, for queue progress display. */
export function requiredCompletion(
  round: EstimateRound,
  multiValues: Record<string, string[]>,
  extras: {
    jobNumber: string;
    jobName: string;
    estimateLeadName: string | null;
  },
  exceptions: FieldExceptionState = {},
  options: { fieldPolicy?: boolean } = {}
): { done: number; total: number } {
  const missing = missingRequiredFields(
    round,
    multiValues,
    extras,
    exceptions,
    options
  );
  const total = applicableRequiredKeys(round, options).length;
  return { done: total - missing.length, total };
}

/**
 * True when a YYYY-MM-DD string is a real calendar date. A regex alone accepts
 * impossible dates like 2026-13-45, which Date would silently roll over.
 */
export function isRealCalendarDate(value: string): boolean {
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

/** Server-side format validation for a single field value. */
export function validateFieldValue(
  key: string,
  raw: string,
  lists: Record<string, string[]>
): { ok: true; value: number | string | null } | { ok: false; error: string } {
  const def = FIELD_DEFS.find((f) => f.key === key);
  if (!def) return { ok: false, error: `Unknown field ${key}` };
  if (raw === "" || raw == null) return { ok: true, value: null };

  switch (def.type) {
    case "number":
    case "dollars": {
      const n = Number(String(raw).replace(/[$,\s]/g, ""));
      if (!Number.isFinite(n))
        return { ok: false, error: `${def.label} must be numeric` };
      return { ok: true, value: n };
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !isRealCalendarDate(raw))
        return { ok: false, error: `${def.label} must be a valid date` };
      return { ok: true, value: raw };
    }
    case "month": {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw))
        return { ok: false, error: `${def.label} must be a valid month` };
      return { ok: true, value: raw };
    }
    case "dropdown": {
      const listValues = def.listKey ? (lists[def.listKey] ?? []) : [];
      // No free-text override — must match the managed reference list
      if (listValues.length > 0 && !listValues.includes(raw))
        return {
          ok: false,
          error: `${def.label} must match a managed list value`,
        };
      return { ok: true, value: raw };
    }
    default: {
      if (raw.length > 500)
        return { ok: false, error: `${def.label} exceeds length limit` };
      return { ok: true, value: raw };
    }
  }
}

export { isRateOnly };
