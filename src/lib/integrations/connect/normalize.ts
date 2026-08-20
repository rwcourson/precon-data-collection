export type ConnectJob = {
  sfId: string;
  jobNumber: string;
  jobName: string;
  region: string;
  marketSector: string | null;
  city: string | null;
  state: string | null;
  createdDate?: string | null;
};

const str = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
};

export function normaliseConnectJob(raw: unknown): ConnectJob | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const sfId = str(record.sfId ?? record.id ?? record.Id);
  const jobNumber = str(
    record.jobNumber ?? record.JobNumber ?? record.job_number
  );
  const jobName = str(record.jobName ?? record.Name ?? record.job_name);
  if (!sfId || !jobNumber || !jobName) return null;
  return {
    sfId,
    jobNumber,
    jobName,
    region: str(record.region ?? record.Region) ?? "",
    marketSector: str(record.marketSector ?? record.MarketSector),
    city: str(record.city ?? record.City),
    state: str(record.state ?? record.State),
    createdDate: str(record.createdDate ?? record.CreatedDate),
  };
}

export function normaliseConnectJobs(payload: unknown): ConnectJob[] {
  const rows = Array.isArray(payload)
    ? payload
    : ((payload as { records?: unknown[] } | null)?.records ?? []);
  return rows
    .map(normaliseConnectJob)
    .filter((job): job is ConnectJob => job != null);
}
