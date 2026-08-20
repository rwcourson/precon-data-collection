export const AWARDABLE_REPORTING_GRAIN = {
  throughput:
    "Locked revisions only; one current revision per round; grouped by precon department and bid year.",
  hitRate:
    "Shadow count of locked awardable efforts with a successful outcome over locked awardable efforts. Dollars stay shadow until early-release aggregation is approved.",
  hitRateBySector:
    "Shadow count of locked awardable efforts with a successful outcome over locked awardable efforts, grouped by market sector.",
  hitRateByLead:
    "Shadow count of locked awardable efforts with a successful outcome over locked awardable efforts, grouped by estimate lead.",
  efficiency:
    "Locked revisions with craft labor man hours; estimate value / man hours by region and market sector.",
  lift: "Locked revisions; self-perform proposed / estimate value and design-build contract type share.",
  coverage:
    "Locked revisions only. Share that have a non-null awardable amount. Sparse fields stay labeled provisional.",
} as const;

export type AwardableReportingRow = {
  roundId: number;
  status: string;
  outcome: string | null;
  region: string;
  preconDepartment: string;
  marketSector: string | null;
  contractType: string | null;
  bidYear: number;
  estimateValue: number | null;
  awardableAmount: number | null;
  contractAmountSigned: number | null;
  craftLaborManHours: number | null;
  selfPerformProposed: number | null;
  estimateLeadName: string | null;
};

function locked(rows: AwardableReportingRow[]) {
  return rows.filter((row) => row.status === "locked");
}

export function awardableCoverage(rows: AwardableReportingRow[]): {
  locked: number;
  withAwardable: number;
  coverage: number | null;
  grain: string;
} {
  const current = locked(rows);
  const withAwardable = current.filter(
    (row) => row.awardableAmount != null
  ).length;
  return {
    locked: current.length,
    withAwardable,
    coverage: current.length === 0 ? null : withAwardable / current.length,
    grain: AWARDABLE_REPORTING_GRAIN.coverage,
  };
}

export function departmentThroughput(rows: AwardableReportingRow[]): {
  department: string;
  bidYear: number;
  lockedCount: number;
  awardableDollars: number | null;
  grain: string;
}[] {
  const groups = new Map<string, AwardableReportingRow[]>();
  for (const row of locked(rows)) {
    const key = `${row.preconDepartment}::${row.bidYear}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [department, year] = key.split("::");
    const dollars = group
      .map((row) => row.awardableAmount)
      .filter((value): value is number => value != null);
    return {
      department: department ?? "",
      bidYear: Number(year),
      lockedCount: group.length,
      awardableDollars:
        dollars.length === 0 ? null : dollars.reduce((sum, n) => sum + n, 0),
      grain: AWARDABLE_REPORTING_GRAIN.throughput,
    };
  });
}

export function shadowAwardableHitRate(rows: AwardableReportingRow[]): {
  attempts: number;
  wins: number;
  rate: number | null;
  grain: string;
  provisional: true;
} {
  return {
    ...hitRateForRows(locked(rows)),
    grain: AWARDABLE_REPORTING_GRAIN.hitRate,
    provisional: true,
  };
}

function hitRateForRows(rows: AwardableReportingRow[]): {
  attempts: number;
  wins: number;
  rate: number | null;
} {
  const awardable = rows.filter((row) => row.awardableAmount != null);
  const wins = awardable.filter((row) =>
    /award|win|success/i.test(row.outcome ?? "")
  ).length;
  return {
    attempts: awardable.length,
    wins,
    rate: awardable.length === 0 ? null : wins / awardable.length,
  };
}

export function shadowAwardableHitRateBySector(rows: AwardableReportingRow[]): {
  sector: string;
  attempts: number;
  wins: number;
  rate: number | null;
  grain: string;
  provisional: true;
}[] {
  return groupHitRates(
    rows,
    (row) => row.marketSector ?? "Unspecified",
    AWARDABLE_REPORTING_GRAIN.hitRateBySector
  ).map(({ key, ...rest }) => ({ sector: key, ...rest }));
}

export function shadowAwardableHitRateByLead(rows: AwardableReportingRow[]): {
  lead: string;
  attempts: number;
  wins: number;
  rate: number | null;
  grain: string;
  provisional: true;
}[] {
  return groupHitRates(
    rows,
    (row) => row.estimateLeadName ?? "Unassigned",
    AWARDABLE_REPORTING_GRAIN.hitRateByLead
  ).map(({ key, ...rest }) => ({ lead: key, ...rest }));
}

function groupHitRates(
  rows: AwardableReportingRow[],
  keyOf: (row: AwardableReportingRow) => string,
  grain: string
): {
  key: string;
  attempts: number;
  wins: number;
  rate: number | null;
  grain: string;
  provisional: true;
}[] {
  const groups = new Map<string, AwardableReportingRow[]>();
  for (const row of locked(rows)) {
    const key = keyOf(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({
    key,
    ...hitRateForRows(group),
    grain,
    provisional: true as const,
  }));
}

export function manHourEfficiency(rows: AwardableReportingRow[]): {
  region: string;
  sector: string;
  dollarsPerHour: number | null;
  coverage: number;
  grain: string;
}[] {
  const groups = new Map<string, AwardableReportingRow[]>();
  for (const row of locked(rows)) {
    const key = `${row.region}::${row.marketSector ?? "Unspecified"}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [region, sector] = key.split("::");
    const usable = group.filter(
      (row) =>
        row.estimateValue != null &&
        row.craftLaborManHours != null &&
        row.craftLaborManHours > 0
    );
    const dollars = usable.reduce(
      (sum, row) => sum + (row.estimateValue ?? 0),
      0
    );
    const hours = usable.reduce(
      (sum, row) => sum + (row.craftLaborManHours ?? 0),
      0
    );
    return {
      region: region ?? "",
      sector: sector ?? "Unspecified",
      dollarsPerHour: hours === 0 ? null : dollars / hours,
      coverage: group.length === 0 ? 0 : usable.length / group.length,
      grain: AWARDABLE_REPORTING_GRAIN.efficiency,
    };
  });
}

export function selfPerformAndDesignBuildLift(rows: AwardableReportingRow[]): {
  selfPerformShare: number | null;
  designBuildShare: number | null;
  grain: string;
} {
  const current = locked(rows);
  const withEstimate = current.filter(
    (row) => row.estimateValue != null && row.estimateValue > 0
  );
  const sp = withEstimate.filter((row) => row.selfPerformProposed != null);
  const selfPerformShare =
    sp.length === 0
      ? null
      : sp.reduce(
          (sum, row) =>
            sum + (row.selfPerformProposed ?? 0) / (row.estimateValue ?? 1),
          0
        ) / sp.length;
  const designBuildShare =
    current.length === 0
      ? null
      : current.filter((row) => /design.?build/i.test(row.contractType ?? ""))
          .length / current.length;
  return {
    selfPerformShare,
    designBuildShare,
    grain: AWARDABLE_REPORTING_GRAIN.lift,
  };
}

export function toAwardableReportingRows(
  rounds: Array<{
    id?: number;
    roundId?: number;
    status: string;
    outcome: string | null;
    region: string;
    preconDepartment: string;
    marketSector: string | null;
    contractType: string | null;
    bidYear: number;
    estimateValue: number | null;
    awardableAmount: number | null;
    contractAmountSigned: number | null;
    craftLaborManHours: number | null;
    selfPerformProposed: number | null;
    estimateLeadName?: string | null;
  }>,
  notApplicableByRound?: ReadonlyMap<number, ReadonlySet<string>>
): AwardableReportingRow[] {
  return rounds.map((round) => {
    const roundId = round.roundId ?? round.id ?? 0;
    const na = notApplicableByRound?.get(roundId);
    return {
      roundId,
      status: round.status,
      outcome: round.outcome,
      region: round.region,
      preconDepartment: round.preconDepartment,
      marketSector: round.marketSector,
      contractType: round.contractType,
      bidYear: round.bidYear,
      estimateValue: round.estimateValue,
      awardableAmount: round.awardableAmount,
      contractAmountSigned: round.contractAmountSigned,
      craftLaborManHours: na?.has("craftLaborManHours")
        ? null
        : round.craftLaborManHours,
      selfPerformProposed: na?.has("selfPerformProposed")
        ? null
        : round.selfPerformProposed,
      estimateLeadName: round.estimateLeadName ?? null,
    };
  });
}

export function awardableExportFooter(columnKeys: string[]): string | null {
  if (
    !columnKeys.some((key) =>
      /awardableAmount|contractAmountSigned|metric:awardableShare|metric:contractConversion/.test(
        key
      )
    )
  ) {
    return null;
  }
  return AWARDABLE_REPORTING_GRAIN.coverage;
}

export function formatAwardableShadowBrief(rows: AwardableReportingRow[]): {
  coverageLine: string;
  hitRateLine: string;
  grain: typeof AWARDABLE_REPORTING_GRAIN;
} {
  const coverage = awardableCoverage(rows);
  const hit = shadowAwardableHitRate(rows);
  return {
    coverageLine:
      coverage.coverage == null
        ? `Awardable coverage (locked, shadow): — · ${coverage.withAwardable}/${coverage.locked}`
        : `Awardable coverage (locked, shadow): ${Math.round(coverage.coverage * 100)}% · ${coverage.withAwardable}/${coverage.locked}`,
    hitRateLine: `Awardable hit rate (shadow, provisional): ${
      hit.rate == null ? "—" : `${Math.round(hit.rate * 100)}%`
    } · ${hit.wins}/${hit.attempts}`,
    grain: AWARDABLE_REPORTING_GRAIN,
  };
}

export function buildAwardableCandidateReport(rows: AwardableReportingRow[]): {
  lockedRowCount: number;
  inFlightIgnored: number;
  coverage: ReturnType<typeof awardableCoverage>;
  hitRate: ReturnType<typeof shadowAwardableHitRate>;
  hitRateBySector: ReturnType<typeof shadowAwardableHitRateBySector>;
  hitRateByLead: ReturnType<typeof shadowAwardableHitRateByLead>;
  throughput: ReturnType<typeof departmentThroughput>;
  efficiency: ReturnType<typeof manHourEfficiency>;
  lift: ReturnType<typeof selfPerformAndDesignBuildLift>;
  productionHitRateUnchanged: true;
} {
  return {
    lockedRowCount: locked(rows).length,
    inFlightIgnored: rows.length - locked(rows).length,
    coverage: awardableCoverage(rows),
    hitRate: shadowAwardableHitRate(rows),
    hitRateBySector: shadowAwardableHitRateBySector(rows),
    hitRateByLead: shadowAwardableHitRateByLead(rows),
    throughput: departmentThroughput(rows),
    efficiency: manHourEfficiency(rows),
    lift: selfPerformAndDesignBuildLift(rows),
    productionHitRateUnchanged: true,
  };
}
