/**
 * Explainable Salesforce opportunity ↔ local job matching (pure).
 */

export type MatchJob = {
  id: number;
  jobNumber: string;
  jobName: string;
  region: string;
  estimateValue?: number | null;
  isLinked: boolean;
  salesforceId: string | null;
};

export type MatchOpportunity = {
  sfId: string;
  jobNumber: string;
  jobName: string;
  region: string;
  expectedValue?: number | null;
  /** Stable version for suppression (e.g. modified timestamp + job number). */
  sourceVersion: string;
};

export type MatchSignals = {
  nameScore: number;
  regionMatch: boolean;
  jobNumberMatch: boolean;
  valueProximity: number;
};

export type MatchCandidate = {
  jobId: number;
  sfId: string;
  sourceVersion: string;
  proposedJobNumber: string;
  proposedJobName: string;
  proposedRegion: string;
  score: number;
  signals: MatchSignals & Record<string, number | boolean | string>;
  discrepancy: string | null;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter(Boolean));
}

/** Jaccard-ish name similarity 0..1 */
export function nameScore(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function valueProximity(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null || a <= 0 || b <= 0) return 0;
  const ratio = Math.min(a, b) / Math.max(a, b);
  return ratio;
}

export function scorePair(job: MatchJob, opp: MatchOpportunity): MatchCandidate {
  const ns = nameScore(job.jobName, opp.jobName);
  const regionMatch =
    normalize(job.region) === normalize(opp.region) && job.region.trim() !== "";
  const jobNumberMatch =
    job.isLinked &&
    job.jobNumber.trim() !== "" &&
    !job.jobNumber.startsWith("TBD-") &&
    normalize(job.jobNumber) === normalize(opp.jobNumber);
  const vp = valueProximity(job.estimateValue, opp.expectedValue);

  let score = ns * 0.55 + (regionMatch ? 0.25 : 0) + (jobNumberMatch ? 0.15 : 0) + vp * 0.05;

  let discrepancy: string | null = null;
  if (
    job.isLinked &&
    job.jobNumber &&
    !job.jobNumber.startsWith("TBD-") &&
    opp.jobNumber &&
    normalize(job.jobNumber) !== normalize(opp.jobNumber) &&
    ns >= 0.4
  ) {
    discrepancy = `job_number_mismatch:local=${job.jobNumber}:sf=${opp.jobNumber}`;
    score = Math.min(score, 0.75);
  }

  return {
    jobId: job.id,
    sfId: opp.sfId,
    sourceVersion: opp.sourceVersion,
    proposedJobNumber: opp.jobNumber,
    proposedJobName: opp.jobName,
    proposedRegion: opp.region,
    score,
    signals: {
      nameScore: Number(ns.toFixed(3)),
      regionMatch,
      jobNumberMatch,
      valueProximity: Number(vp.toFixed(3)),
    },
    discrepancy,
  };
}

/**
 * Produce pending candidates above threshold, skipping suppressed pairs and
 * already-linked identical sfIds.
 */
export function proposeMatches(
  jobs: MatchJob[],
  opps: MatchOpportunity[],
  suppressions: { jobId: number | null; sfId: string; sourceVersion: string }[],
  threshold = 0.35,
): MatchCandidate[] {
  const out: MatchCandidate[] = [];
  const suppressed = new Set(
    suppressions.map((s) => `${s.jobId ?? "*"}:${s.sfId}:${s.sourceVersion}`),
  );
  const linkedSfIds = new Set(
    jobs.map((j) => j.salesforceId).filter((id): id is string => Boolean(id)),
  );

  for (const opp of opps) {
    // Already associated with a local job — do not re-propose.
    if (linkedSfIds.has(opp.sfId)) continue;
    let best: MatchCandidate | null = null;
    for (const job of jobs) {
      const keyExact = `${job.id}:${opp.sfId}:${opp.sourceVersion}`;
      const keyWild = `*:${opp.sfId}:${opp.sourceVersion}`;
      if (suppressed.has(keyExact) || suppressed.has(keyWild)) continue;
      const c = scorePair(job, opp);
      if (c.score < threshold) continue;
      if (!best || c.score > best.score) best = c;
    }
    if (best) out.push(best);
  }

  return out.sort((a, b) => b.score - a.score);
}
