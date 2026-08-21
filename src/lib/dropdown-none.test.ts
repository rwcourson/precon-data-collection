import { describe, expect, it } from "vitest";
import {
  DROPDOWN_NONE_VALUE,
  dropdownCommitValue,
  dropdownItems,
  dropdownSelectValue,
  listHasNone,
} from "./dropdown-none";

const AWARDABILITY = [
  "Work Under Contract – Hard Bid",
  "Work Under Contract – GMP",
  "Work Under Contract – Early Release",
  "Not Work Under Contract – Budget",
  "Not Work Under Contract – Other",
];

describe("dropdown none", () => {
  it("adds a None option when the list does not already have one", () => {
    expect(listHasNone(AWARDABILITY)).toBe(false);
    expect(dropdownItems(AWARDABILITY)[0]).toEqual({
      value: DROPDOWN_NONE_VALUE,
      label: "None",
    });
  });

  it("does not duplicate None when the managed list already includes it", () => {
    const options = ["None", "IJV – Cross Division"];
    expect(listHasNone(options)).toBe(true);
    expect(dropdownItems(options).map((item) => item.value)).toEqual(options);
  });

  it("maps a blank cell to the None sentinel so the value can be cleared", () => {
    expect(dropdownSelectValue("", AWARDABILITY)).toBe(DROPDOWN_NONE_VALUE);
    expect(dropdownCommitValue(DROPDOWN_NONE_VALUE)).toBe("");
    expect(dropdownCommitValue(null)).toBe("");
    expect(dropdownCommitValue("Work Under Contract – GMP")).toBe(
      "Work Under Contract – GMP"
    );
  });

  it("leaves a real list value of None stored as None", () => {
    const options = ["None", "IJV – Cross Division"];
    expect(dropdownSelectValue("None", options)).toBe("None");
    expect(dropdownCommitValue("None")).toBe("None");
    expect(dropdownSelectValue("", options)).toBeUndefined();
  });
});
