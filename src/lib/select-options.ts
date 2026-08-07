export type UrlSelectOption = {
  value: string;
  label: string;
};

/** Builds `UrlSelect` options from reference-list values; `all` becomes the reset entry. */
export function toOptions(values: string[], allLabel?: string): UrlSelectOption[] {
  return values.map((v) => ({
    value: v,
    label: v === "all" ? (allLabel ?? "All") : v.replaceAll("_", " "),
  }));
}
