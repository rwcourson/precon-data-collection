/** Stored `TBD-*` identities stay unchanged; the board shows a pending label. */
export function displayJobNumber(jobNumber: string | null | undefined): string {
  const value = jobNumber?.trim() ?? "";
  if (!value) return "—";
  return /^TBD-/i.test(value) ? "Pending job number" : value;
}

export function fmtDollars(
  v: number | null | undefined,
  compact = false
): string {
  if (v == null) return "—";
  if (compact) {
    if (Math.abs(v) >= 1_000_000_000)
      return `$${(v / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  }
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function fmtNumber(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function fmtPercent(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(`${v}T00:00:00`) : v;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(v: Date | null | undefined): string {
  if (!v) return "—";
  return v.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Strip grouping so a typed or pasted money string stays numeric. */
export function parseNumericInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const negative = /^-/.test(trimmed.replace(/[$,\s]/g, ""));
  const cleaned = trimmed.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const intDigits = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(
    /\D/g,
    ""
  );
  const frac = dot === -1 ? null : cleaned.slice(dot + 1).replace(/\D/g, "");
  const intPart = intDigits.replace(/^0+(?=\d)/, "");
  const next =
    frac == null
      ? intPart
      : `${intPart || (cleaned.startsWith(".") ? "0" : "")}.${frac}`;
  if (!next || next === ".") return negative ? "-" : "";
  return `${negative ? "-" : ""}${next}`;
}

/** Group thousands for the input the user is typing. Keeps a trailing decimal. */
export function formatNumericInput(raw: string): string {
  const parsed = parseNumericInput(raw);
  if (!parsed) return "";
  if (parsed === "-") return "-";
  const negative = parsed.startsWith("-");
  const unsigned = negative ? parsed.slice(1) : parsed;
  const [intPart = "", fracPart] = unsigned.split(".");
  const hasDot = unsigned.includes(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${hasDot ? `.${fracPart ?? ""}` : ""}`;
}

export function significantNumericCount(value: string): number {
  return (value.match(/[\d.]/g) ?? []).length;
}

export function caretAfterSignificant(
  formatted: string,
  count: number
): number {
  if (count <= 0) return formatted.startsWith("-") ? 1 : 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d.]/.test(formatted[i]!)) {
      seen += 1;
      if (seen >= count) return i + 1;
    }
  }
  return formatted.length;
}

/** Format a raw field value according to its field type. */
export function fmtFieldValue(
  value: unknown,
  type: "text" | "number" | "dollars" | "date" | "month" | "dropdown" | "multi"
): string {
  if (value == null || value === "") return "—";
  switch (type) {
    case "dollars":
      return fmtDollars(Number(value));
    case "number":
      return fmtNumber(Number(value));
    case "date":
      return fmtDate(String(value));
    case "month":
      return new Date(`${String(value)}-01T00:00:00`).toLocaleDateString(
        "en-US",
        { month: "short", year: "numeric" }
      );
    case "multi":
      return Array.isArray(value) ? value.join(", ") : String(value);
    default:
      return String(value);
  }
}
