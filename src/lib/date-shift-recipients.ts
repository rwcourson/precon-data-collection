export type DateShiftRecipientSource = "lead" | "rpd";

export type DateShiftRecipientRules = {
  estimateLead: boolean;
  regionalRpd: boolean;
};

export const DEFAULT_DATE_SHIFT_RECIPIENTS: DateShiftRecipientRules = {
  estimateLead: true,
  regionalRpd: true,
};

export function normalizeDateShiftRecipients(
  raw?: Partial<DateShiftRecipientRules> | null
): DateShiftRecipientRules {
  return {
    estimateLead: raw?.estimateLead !== false,
    regionalRpd: raw?.regionalRpd !== false,
  };
}

export function includeDateShiftRecipient(
  source: DateShiftRecipientSource,
  rules: DateShiftRecipientRules
): boolean {
  return source === "lead" ? rules.estimateLead : rules.regionalRpd;
}
