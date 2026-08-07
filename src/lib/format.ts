export function fmtDollars(v: number | null | undefined, compact = false): string {
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
  if (v == null || !isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(`${v}T00:00:00`) : v;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

/** Format a raw field value according to its field type. */
export function fmtFieldValue(
  value: unknown,
  type: "text" | "number" | "dollars" | "date" | "dropdown" | "multi",
): string {
  if (value == null || value === "") return "—";
  switch (type) {
    case "dollars":
      return fmtDollars(Number(value));
    case "number":
      return fmtNumber(Number(value));
    case "date":
      return fmtDate(String(value));
    case "multi":
      return Array.isArray(value) ? value.join(", ") : String(value);
    default:
      return String(value);
  }
}
