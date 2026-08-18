/**
 * DMR vs precon reconciliation (pure). Keeps DMR and precon values separate;
 * never overwrites source rows — only computes deltas.
 */

export type DmrLineInput = {
  jobNumber: string;
  jobName?: string | null;
  region?: string | null;
  dmrValue: number;
};

export type PreconLineInput = {
  jobNumber: string;
  jobName: string;
  region: string;
  preconValue: number;
  roundId: number;
};

export type ReconcileRow = {
  jobNumber: string;
  jobName: string;
  region: string;
  dmrValue: number | null;
  preconValue: number | null;
  delta: number | null;
  status: "matched" | "dmr_only" | "precon_only";
  roundId: number | null;
};

export function reconcileDmr(
  dmr: DmrLineInput[],
  precon: PreconLineInput[]
): {
  rows: ReconcileRow[];
  totals: { dmr: number; precon: number; delta: number };
} {
  const dmrByJob = new Map<string, DmrLineInput>();
  for (const row of dmr) {
    const key = row.jobNumber.trim();
    const prev = dmrByJob.get(key);
    if (prev) {
      dmrByJob.set(key, { ...prev, dmrValue: prev.dmrValue + row.dmrValue });
    } else {
      dmrByJob.set(key, row);
    }
  }

  const preconByJob = new Map<string, PreconLineInput>();
  for (const row of precon) {
    const key = row.jobNumber.trim();
    const prev = preconByJob.get(key);
    if (prev) {
      preconByJob.set(key, {
        ...prev,
        preconValue: prev.preconValue + row.preconValue,
      });
    } else {
      preconByJob.set(key, row);
    }
  }

  const keys = new Set([...dmrByJob.keys(), ...preconByJob.keys()]);
  const rows: ReconcileRow[] = [];
  let dmrTotal = 0;
  let preconTotal = 0;

  for (const key of [...keys].sort()) {
    const d = dmrByJob.get(key);
    const p = preconByJob.get(key);
    const dmrValue = d?.dmrValue ?? null;
    const preconValue = p?.preconValue ?? null;
    if (dmrValue != null) dmrTotal += dmrValue;
    if (preconValue != null) preconTotal += preconValue;
    const status: ReconcileRow["status"] =
      d && p ? "matched" : d ? "dmr_only" : "precon_only";
    rows.push({
      jobNumber: key,
      jobName: p?.jobName ?? d?.jobName ?? key,
      region: p?.region ?? d?.region ?? "",
      dmrValue,
      preconValue,
      delta:
        dmrValue != null && preconValue != null ? preconValue - dmrValue : null,
      status,
      roundId: p?.roundId ?? null,
    });
  }

  return {
    rows,
    totals: {
      dmr: dmrTotal,
      precon: preconTotal,
      delta: preconTotal - dmrTotal,
    },
  };
}
