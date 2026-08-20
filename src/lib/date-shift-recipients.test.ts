import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATE_SHIFT_RECIPIENTS,
  includeDateShiftRecipient,
  normalizeDateShiftRecipients,
} from "./date-shift-recipients";

describe("date-shift recipient rules", () => {
  it("defaults to estimate lead and regional RPD/SPD", () => {
    expect(normalizeDateShiftRecipients(undefined)).toEqual(
      DEFAULT_DATE_SHIFT_RECIPIENTS
    );
    expect(
      includeDateShiftRecipient("lead", DEFAULT_DATE_SHIFT_RECIPIENTS)
    ).toBe(true);
    expect(
      includeDateShiftRecipient("rpd", DEFAULT_DATE_SHIFT_RECIPIENTS)
    ).toBe(true);
  });

  it("can disable a recipient class without dropping in-app/email channels", () => {
    const rules = normalizeDateShiftRecipients({
      estimateLead: true,
      regionalRpd: false,
    });
    expect(includeDateShiftRecipient("lead", rules)).toBe(true);
    expect(includeDateShiftRecipient("rpd", rules)).toBe(false);
  });
});
