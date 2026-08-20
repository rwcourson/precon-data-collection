import { DomainError } from "@/domain/errors";

/** Minimal job shape needed to confirm a Salesforce match-and-merge. */
export type LinkableJob = {
  id: number;
  jobNumber: string;
  jobName: string;
  salesforceId: string | null;
  isLinked: boolean;
};

export type SalesforceJobRecord = {
  sfId: string;
  jobNumber: string;
  jobName: string;
  region?: string | null;
  marketSector?: string | null;
  city?: string | null;
  state?: string | null;
};

export type SalesforceShadow = {
  jobName: string | null;
  region: string | null;
  marketSector: string | null;
  city: string | null;
  state: string | null;
};

function shadowFrom(sf: SalesforceJobRecord): SalesforceShadow {
  return {
    jobName: sf.jobName,
    region: sf.region ?? null,
    marketSector: sf.marketSector ?? null,
    city: sf.city ?? null,
    state: sf.state ?? null,
  };
}

export type SalesforceLinkPlan = {
  /** Always the original job primary key — rounds stay attached. */
  jobId: number;
  patch: {
    jobNumber: string;
    salesforceId: string;
    salesforceShadow: Record<string, string | null>;
    isLinked: true;
  };
  audit: {
    entity: "job_match";
    action: "salesforce_link_confirmed";
    field: "jobNumber";
    oldValue: string;
    newValue: string;
  };
  /** Caller must verify these round ids still belong to jobId after link. */
  preservedRoundIds: number[];
};

/**
 * Pure match-and-merge plan: update identity fields on the same job row;
 * never reassign or drop estimate rounds.
 */
export function planSalesforceLink(
  job: LinkableJob,
  sf: SalesforceJobRecord | null | undefined,
  roundIds: number[]
): SalesforceLinkPlan {
  if (!sf) {
    throw DomainError.notFound(
      "Salesforce record not found",
      "The selected Salesforce id is not available from the Connect provider."
    );
  }
  if (job.isLinked || job.salesforceId) {
    throw DomainError.conflict(
      "Job is already linked",
      "A Salesforce job number is already associated with this pursuit."
    );
  }

  return {
    jobId: job.id,
    patch: {
      jobNumber: sf.jobNumber,
      salesforceId: sf.sfId,
      salesforceShadow: shadowFrom(sf),
      isLinked: true,
    },
    audit: {
      entity: "job_match",
      action: "salesforce_link_confirmed",
      field: "jobNumber",
      oldValue: job.jobNumber,
      newValue: sf.jobNumber,
    },
    preservedRoundIds: [...roundIds],
  };
}

/** In-memory model used by unit tests to prove ROM history survives linking. */
export type PursuitHistoryState = {
  job: LinkableJob;
  rounds: { id: number; estimatePhase: string }[];
};

export function applySalesforceLinkPlan(
  state: PursuitHistoryState,
  plan: SalesforceLinkPlan
): PursuitHistoryState {
  if (plan.jobId !== state.job.id) {
    throw DomainError.conflict(
      "Link plan targets a different job",
      "Salesforce linking must update the original job id."
    );
  }
  const roundIds = state.rounds.map((r) => r.id);
  for (const id of plan.preservedRoundIds) {
    if (!roundIds.includes(id)) {
      throw DomainError.conflict(
        "Link would drop estimate rounds",
        `Round ${id} is missing from the pursuit history.`
      );
    }
  }
  return {
    job: {
      ...state.job,
      ...plan.patch,
    },
    rounds: state.rounds.map((r) => ({ ...r })),
  };
}

export type SalesforceUnlinkPlan = {
  jobId: number;
  patch: { isLinked: false; salesforceId: null };
  undo: { isLinked: true; salesforceId: string };
};

export function planSalesforceUnlink(job: LinkableJob): SalesforceUnlinkPlan {
  if (!job.isLinked && !job.salesforceId) {
    throw DomainError.badRequest(
      "Job is not linked",
      "There is no Salesforce job number to unlink."
    );
  }
  return {
    jobId: job.id,
    patch: { isLinked: false, salesforceId: null },
    undo: { isLinked: true, salesforceId: job.salesforceId ?? "" },
  };
}

/** Typing over an accepted suggestion breaks the link and keeps an undo handle. */
export function typeOverSalesforceSuggestion<T>(current: T | null): {
  selected: null;
  undo: T | null;
} {
  return { selected: null, undo: current };
}

export function applySalesforceUnlinkPlan(
  state: PursuitHistoryState,
  plan: SalesforceUnlinkPlan
): PursuitHistoryState {
  return {
    job: { ...state.job, ...plan.patch },
    rounds: state.rounds.map((round) => ({ ...round })),
  };
}

export function assertSalesforceJobNumberAvailable(
  jobNumber: string,
  existing: { id: number; jobNumber: string }[],
  currentJobId: number
): void {
  const clash = existing.find(
    (row) => row.jobNumber === jobNumber && row.id !== currentJobId
  );
  if (clash) {
    throw DomainError.conflict(
      "Salesforce job number already in use",
      `Job ${clash.id} already uses ${jobNumber}.`
    );
  }
}
