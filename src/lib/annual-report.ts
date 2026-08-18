import type { EstimateRound } from "@/db/schema";
import { fmtDollars, fmtPercent } from "./format";
import type { RoundRow } from "./queries";
import { computeStats, type RollupStats, rollup } from "./rollup";

/**
 * Annual Regional Report — the leadership "yearbook" from PPT slides 18-20:
 * multi-year pursuit trends, the current-year scorecard, sector and department
 * breakdowns, and the wins that made the year. Rendered as one document rather
 * than a flat table, because that is how it gets presented.
 */

export type AnnualReportInput = {
  rows: RoundRow[];
  region: string | null;
  fromYear: number;
  toYear: number;
};

export type AnnualHighlight = {
  jobNumber: string;
  jobName: string;
  marketSector: string | null;
  preconDepartment: string;
  estimateValue: number | null;
  estimatePhase: string;
};

export type AnnualReport = {
  scope: string;
  fromYear: number;
  toYear: number;
  years: { year: number; stats: RollupStats }[];
  overall: RollupStats;
  focusYear: number;
  focus: RollupStats;
  priorYear: RollupStats | null;
  bySector: RollupStats[];
  byDepartment: RollupStats[];
  wins: AnnualHighlight[];
  emptyReason: string | null;
};

export function buildAnnualReport({
  rows,
  region,
  fromYear,
  toYear,
}: AnnualReportInput): AnnualReport {
  const scope = region ?? "Corporate — All Regions";
  const inScope = rows
    .map((r) => r.round)
    .filter(
      (r) =>
        (region == null || r.region === region) &&
        r.bidYear >= fromYear &&
        r.bidYear <= toYear
    );

  const years: { year: number; stats: RollupStats }[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    years.push({
      year: y,
      stats: computeStats(
        String(y),
        inScope.filter((r) => r.bidYear === y)
      ),
    });
  }

  const focusYear = toYear;
  const focusRounds = inScope.filter((r) => r.bidYear === focusYear);
  const priorRounds = inScope.filter((r) => r.bidYear === focusYear - 1);

  const wins = focusRounds
    .filter((r) => r.outcome === "successful")
    .sort((a, b) => (b.estimateValue ?? 0) - (a.estimateValue ?? 0))
    .slice(0, 10)
    .map(toHighlight(rows));

  return {
    scope,
    fromYear,
    toYear,
    years,
    overall: computeStats("all", inScope),
    focusYear,
    focus: computeStats(String(focusYear), focusRounds),
    priorYear:
      priorRounds.length > 0
        ? computeStats(String(focusYear - 1), priorRounds)
        : null,
    bySector: rollup(focusRounds, (r) => r.marketSector ?? "Unclassified"),
    byDepartment: rollup(focusRounds, (r) => r.preconDepartment),
    wins,
    emptyReason:
      inScope.length === 0
        ? `No estimate rounds recorded for ${scope} between ${fromYear} and ${toYear}.`
        : null,
  };
}

function toHighlight(rows: RoundRow[]) {
  const jobById = new Map(rows.map((r) => [r.round.id, r.job]));
  return (r: EstimateRound): AnnualHighlight => {
    const job = jobById.get(r.id);
    return {
      jobNumber: job?.jobNumber ?? "—",
      jobName: job?.jobName ?? "—",
      marketSector: r.marketSector,
      preconDepartment: r.preconDepartment,
      estimateValue: r.estimateValue,
      estimatePhase: r.estimatePhase,
    };
  };
}

// ---- HTML rendering (feeds the PDF engine and the on-screen preview) ----

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const delta = (
  current: number | null,
  prior: number | null | undefined
): string => {
  if (current == null || prior == null || prior === 0) return "";
  const change = (current - prior) / Math.abs(prior);
  const up = change >= 0;
  // A near-zero prior year produces a percentage that reads as noise rather
  // than signal, so past 10x it is reported qualitatively.
  const text =
    Math.abs(change) > 10
      ? `${up ? "Up" : "Down"} sharply vs prior year`
      : `${up ? "+" : ""}${(change * 100).toFixed(0)}% vs prior year`;
  return `<span class="delta ${up ? "up" : "down"}">${esc(text)}</span>`;
};

export function renderAnnualReportHtml(report: AnnualReport): string {
  const { focus, priorYear } = report;

  const scorecard = [
    {
      label: "Pursuit Volume",
      value: fmtDollars(focus.volume, true),
      delta: delta(focus.volume, priorYear?.volume),
    },
    {
      label: "Estimate Rounds",
      value: String(focus.rounds),
      delta: delta(focus.rounds, priorYear?.rounds),
    },
    {
      label: "Win Rate (count)",
      value: fmtPercent(focus.winRate),
      delta: delta(focus.winRate, priorYear?.winRate),
    },
    {
      label: "Win Rate (value)",
      value: fmtPercent(focus.winRateByValue),
      delta: delta(focus.winRateByValue, priorYear?.winRateByValue),
    },
    {
      label: "Won Volume",
      value: fmtDollars(focus.wonVolume, true),
      delta: delta(focus.wonVolume, priorYear?.wonVolume),
    },
    {
      label: "Expected Fee",
      value: fmtDollars(focus.totalFee, true),
      delta: delta(focus.totalFee, priorYear?.totalFee),
    },
    {
      label: "Fee % of Volume",
      value: fmtPercent(focus.weightedFeePct),
      delta: delta(focus.weightedFeePct, priorYear?.weightedFeePct),
    },
    {
      label: "Contingency % of Volume",
      value: fmtPercent(focus.weightedContingencyPct),
      delta: "",
    },
    {
      label: "GC+GR % of Volume",
      value: fmtPercent(focus.weightedGcGrPct),
      delta: "",
    },
    {
      label: "Revenue per PM Year",
      value: fmtDollars(focus.revenuePerPmYear, true),
      delta: delta(focus.revenuePerPmYear, priorYear?.revenuePerPmYear),
    },
    {
      label: "Self-Perform Capture",
      value: fmtPercent(focus.selfPerformCaptureRate),
      delta: "",
    },
    {
      label: "Craft Labor $ / Man Hour",
      value: fmtDollars(focus.laborCostPerManHour),
      delta: "",
    },
  ];

  const trendRows = report.years
    .map(
      ({ year, stats }) => `<tr>
      <td>${year}</td>
      <td class="num">${stats.rounds}</td>
      <td class="num">${fmtDollars(stats.volume, true)}</td>
      <td class="num">${fmtDollars(stats.wonVolume, true)}</td>
      <td class="num">${fmtPercent(stats.winRate)}</td>
      <td class="num">${fmtPercent(stats.weightedFeePct)}</td>
      <td class="num">${fmtPercent(stats.weightedContingencyPct)}</td>
      <td class="num">${fmtDollars(stats.feePerPmMonth, true)}</td>
    </tr>`
    )
    .join("");

  const GROUP_LIMIT = 20;
  const groupRows = (groups: RollupStats[]) => {
    const shown = groups.slice(0, GROUP_LIMIT);
    const rest = groups.slice(GROUP_LIMIT);
    const row = (
      key: string,
      rounds: number,
      volume: number,
      winRate: number | null,
      feePct: number | null
    ) => `<tr>
      <td>${esc(key)}</td>
      <td class="num">${rounds}</td>
      <td class="num">${fmtDollars(volume, true)}</td>
      <td class="num">${fmtPercent(winRate)}</td>
      <td class="num">${fmtPercent(feePct)}</td>
    </tr>`;

    let html = shown
      .map((g) => row(g.key, g.rounds, g.volume, g.winRate, g.weightedFeePct))
      .join("");
    if (rest.length > 0) {
      const rounds = rest.reduce((s, g) => s + g.rounds, 0);
      const volume = rest.reduce((s, g) => s + g.volume, 0);
      const fee = rest.reduce((s, g) => s + g.totalFee, 0);
      const wonVolume = rest.reduce((s, g) => s + g.wonVolume, 0);
      const decidedVolume = rest.reduce((s, g) => s + g.decidedVolume, 0);
      html += row(
        `All other (${rest.length})`,
        rounds,
        volume,
        decidedVolume > 0 ? wonVolume / decidedVolume : null,
        volume > 0 ? fee / volume : null
      );
    }
    return html;
  };

  const winRows = report.wins
    .map(
      (w) => `<tr>
      <td>${esc(w.jobName)}<span class="sub">#${esc(w.jobNumber)}</span></td>
      <td>${esc(w.marketSector ?? "—")}</td>
      <td>${esc(w.preconDepartment)}</td>
      <td>${esc(w.estimatePhase)}</td>
      <td class="num">${fmtDollars(w.estimateValue, true)}</td>
    </tr>`
    )
    .join("");

  // A bare-bones column chart, drawn with divs so no chart library is needed.
  const maxVolume = Math.max(1, ...report.years.map((y) => y.stats.volume));
  const chart = report.years
    .map(({ year, stats }) => {
      const height = Math.round((stats.volume / maxVolume) * 100);
      return `<div class="bar-col">
        <span class="bar-value">${fmtDollars(stats.volume, true)}</span>
        <div class="bar" style="height:${Math.max(height, 2)}%"></div>
        <span class="bar-label">${year}</span>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(report.scope)} Annual Preconstruction Report ${report.toYear}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; margin: 30px; color: #16202b; }
  .cover { border-bottom: 3px solid #1e3a5f; padding-bottom: 14px; margin-bottom: 22px; }
  .eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #64748b; margin: 0 0 6px; }
  h1 { font-size: 26px; margin: 0 0 4px; color: #1e3a5f; letter-spacing: -0.01em; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #1e3a5f; margin: 26px 0 10px; }
  .meta { font-size: 11px; color: #64748b; margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .kpi { border: 1px solid #dbe3ec; border-radius: 6px; padding: 9px 11px; }
  .kpi .label { font-size: 9.5px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
  .kpi .value { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; color: #16202b; margin-top: 2px; }
  .delta { display: block; font-size: 9px; margin-top: 1px; }
  .delta.up { color: #15803d; }
  .delta.down { color: #b91c1c; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5px; }
  th { background: #1e3a5f; color: white; text-align: left; padding: 6px 8px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .sub { display: block; font-size: 9px; color: #94a3b8; }
  .chart { display: flex; align-items: flex-end; gap: 14px; height: 150px; padding: 18px 4px 0; border-bottom: 1px solid #cbd5e1; }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
  .bar { width: 100%; max-width: 64px; background: linear-gradient(180deg, #2f5f92, #1e3a5f); border-radius: 3px 3px 0 0; }
  .bar-value { font-size: 9px; color: #475569; margin-bottom: 3px; font-variant-numeric: tabular-nums; }
  .bar-label { font-size: 10px; color: #64748b; margin-top: 5px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .note { font-size: 9.5px; color: #94a3b8; margin-top: 6px; }
  .empty { padding: 40px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 8px; }
  .toolbar { position: fixed; top: 12px; right: 12px; }
  .toolbar button { padding: 8px 16px; background: #1e3a5f; color: white; border: 0; border-radius: 6px; cursor: pointer; font-size: 13px; }
  @media print { .toolbar { display: none; } body { margin: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>

  <header class="cover">
    <p class="eyebrow">Brasfield &amp; Gorrie · Preconstruction</p>
    <h1>${esc(report.scope)} — Annual Preconstruction Report</h1>
    <p class="meta">Bid Years ${report.fromYear}–${report.toYear} · ${report.overall.rounds} estimate rounds · Generated ${new Date().toLocaleDateString(
      "en-US",
      { dateStyle: "long" }
    )}</p>
  </header>

  ${
    report.emptyReason
      ? `<div class="empty">${esc(report.emptyReason)}</div>`
      : `
  <h2>${report.focusYear} Scorecard</h2>
  <div class="grid">
    ${scorecard
      .map(
        (k) => `<div class="kpi">
      <div class="label">${esc(k.label)}</div>
      <div class="value">${k.value}</div>
      ${k.delta}
    </div>`
      )
      .join("")}
  </div>

  <h2>Pursuit volume by bid year</h2>
  <div class="chart">${chart}</div>
  <p class="note">Each estimate round counts as its own record — multiple pricing rounds on one job contribute multiple records.</p>

  <h2>Multi-year trend detail</h2>
  <table>
    <thead><tr>
      <th>Bid Year</th><th class="num">Rounds</th><th class="num">Volume</th>
      <th class="num">Won Volume</th><th class="num">Win Rate</th>
      <th class="num">Fee %</th><th class="num">Contingency %</th><th class="num">Fee / PM Mo</th>
    </tr></thead>
    <tbody>${trendRows}</tbody>
  </table>

  <h2>${report.focusYear} by market sector</h2>
  <table>
    <thead><tr>
      <th>Market Sector</th><th class="num">Rounds</th><th class="num">Volume</th>
      <th class="num">Win Rate</th><th class="num">Fee %</th>
    </tr></thead>
    <tbody>${groupRows(report.bySector)}</tbody>
  </table>

  <h2>${report.focusYear} by precon department</h2>
  <table>
    <thead><tr>
      <th>Precon Department</th><th class="num">Rounds</th><th class="num">Volume</th>
      <th class="num">Win Rate</th><th class="num">Fee %</th>
    </tr></thead>
    <tbody>${groupRows(report.byDepartment)}</tbody>
  </table>

  <h2>${report.focusYear} wins</h2>
  ${
    report.wins.length === 0
      ? `<p class="note">No successful outcomes recorded for ${report.focusYear} yet.</p>`
      : `<table>
    <thead><tr>
      <th>Project</th><th>Market Sector</th><th>Precon Department</th>
      <th>Estimate Phase</th><th class="num">Estimate Value</th>
    </tr></thead>
    <tbody>${winRows}</tbody>
  </table>`
  }
  `
  }
</body>
</html>`;
}
