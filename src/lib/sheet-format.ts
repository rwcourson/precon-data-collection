import { fmtDate, fmtDollars } from "./format";

/**
 * How a sheet cell reads. Shared by the grid and by exports so a printed sheet
 * says the same thing as the screen it was printed from — a PDF that shows
 * `true` where the sheet shows `Yes` is the kind of mismatch that makes people
 * keep the spreadsheet open next to the app.
 */

/** Column types that right-align and sort numerically. */
export function isNumericType(type: string): boolean {
  return ["number", "dollars", "metric"].includes(type);
}

export function formatCell(type: string, value: string | number | null): string {
  if (value == null || value === "") return "—";
  switch (type) {
    case "dollars":
      // Estimates run to the hundreds of millions and only read at a glance
      // abbreviated; a roster's monthly cost has to keep its dollars.
      return fmtDollars(Number(value), Math.abs(Number(value)) >= 1_000_000);
    case "date":
      return fmtDate(String(value));
    case "number":
      return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
    case "checkbox":
      return String(value) === "true" ? "Yes" : "";
    default:
      return String(value);
  }
}
