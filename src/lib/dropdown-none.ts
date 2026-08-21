/** Sentinel so a select can clear a cell. Empty string is not a valid item value. */
export const DROPDOWN_NONE_VALUE = "__none__";

export function listHasNone(options: readonly string[]): boolean {
  return options.some((option) => option.trim().toLowerCase() === "none");
}

/** Value for Select.Root — never `""`, which Base UI rejects. */
export function dropdownSelectValue(
  stored: string | null | undefined,
  options: readonly string[]
): string | undefined {
  if (stored) return stored;
  if (listHasNone(options)) return undefined;
  return DROPDOWN_NONE_VALUE;
}

export function dropdownCommitValue(
  selected: string | null | undefined
): string {
  if (selected == null || selected === "" || selected === DROPDOWN_NONE_VALUE) {
    return "";
  }
  return selected;
}

export function dropdownItems(
  options: readonly string[]
): { value: string; label: string }[] {
  const items = options.map((option) => ({ value: option, label: option }));
  if (listHasNone(options)) return items;
  return [{ value: DROPDOWN_NONE_VALUE, label: "None" }, ...items];
}
