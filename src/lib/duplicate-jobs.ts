import { nameScore } from "@/lib/salesforce-match";

/** Warn often: a dismissible card is cheaper than a second Auburn. */
export const DUPLICATE_SCORE_THRESHOLD = 0.42;

const ABBREVIATIONS: Record<string, string> = {
  perf: "performance",
  ctr: "center",
  ctrs: "centers",
  bldg: "building",
  bldgs: "buildings",
  hosp: "hospital",
  univ: "university",
  dept: "department",
  ph: "phase",
};

export function normalizeJobName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ABBREVIATIONS[token] ?? token)
    .join(" ");
}

export function trigramSet(name: string): Set<string> {
  const padded = `  ${normalizeJobName(name)} `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

export function trigramScore(a: string, b: string): number {
  const left = trigramSet(a);
  const right = trigramSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let inter = 0;
  for (const gram of left) if (right.has(gram)) inter++;
  return inter / (left.size + right.size - inter);
}

export type DuplicateCandidate = {
  jobName: string;
  city?: string | null;
  state?: string | null;
  owner?: string | null;
};

export type DuplicateExisting = DuplicateCandidate & {
  jobId: number;
  jobNumber: string;
  homeRegion: string;
  creatorName: string | null;
  lastActivityAt: Date | string | null;
};

export type DuplicateSignals = {
  nameScore: number;
  trigramScore: number;
  cityMatch: boolean;
  stateMatch: boolean;
  ownerMatch: boolean;
};

export type DuplicateMatch = {
  jobId: number;
  jobName: string;
  jobNumber: string;
  homeRegion: string;
  creatorName: string | null;
  lastActivityAt: string | null;
  score: number;
  signals: DuplicateSignals;
};

function normPlace(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function scoreDuplicateJob(
  candidate: DuplicateCandidate,
  existing: DuplicateExisting,
): DuplicateMatch {
  const tokenName = nameScore(normalizeJobName(candidate.jobName), normalizeJobName(existing.jobName));
  const grams = trigramScore(candidate.jobName, existing.jobName);
  const cityMatch =
    Boolean(normPlace(candidate.city)) && normPlace(candidate.city) === normPlace(existing.city);
  const stateMatch =
    Boolean(normPlace(candidate.state)) && normPlace(candidate.state) === normPlace(existing.state);
  const ownerMatch =
    Boolean(normPlace(candidate.owner)) && normPlace(candidate.owner) === normPlace(existing.owner);

  const score =
    tokenName * 0.5 +
    grams * 0.3 +
    (cityMatch ? 0.1 : 0) +
    (stateMatch ? 0.05 : 0) +
    (ownerMatch ? 0.05 : 0);

  const last =
    existing.lastActivityAt instanceof Date
      ? existing.lastActivityAt.toISOString()
      : existing.lastActivityAt;

  return {
    jobId: existing.jobId,
    jobName: existing.jobName,
    jobNumber: existing.jobNumber,
    homeRegion: existing.homeRegion,
    creatorName: existing.creatorName,
    lastActivityAt: last,
    score: Number(score.toFixed(3)),
    signals: {
      nameScore: Number(tokenName.toFixed(3)),
      trigramScore: Number(grams.toFixed(3)),
      cityMatch,
      stateMatch,
      ownerMatch,
    },
  };
}

export function findDuplicateJobs(
  candidate: DuplicateCandidate,
  existing: DuplicateExisting[],
  threshold = DUPLICATE_SCORE_THRESHOLD,
): DuplicateMatch[] {
  if (!candidate.jobName.trim()) return [];
  return existing
    .map((row) => scoreDuplicateJob(candidate, row))
    .filter((row) => row.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
