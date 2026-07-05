/**
 * Profit score — recent resale price appreciation (CAGR) vs the regional
 * baseline, split by bedroom type. Deterministic & explainable (SPEC §5.2).
 *
 * Pure: takes plain data, returns a ProjectScore. No DB.
 */

import {
  type ProjectScore,
  type ScoringInput,
  type TxnLite,
  type Confidence,
  type MarketRegime,
  SCORE_VERSION,
  scoreToBand,
  clamp,
  median,
} from "./types";

const WINDOW_YEARS = 3; // look-back window for the CAGR trend
const MIN_GROUP_SAMPLE = 4; // per-bedroom min resale txns to be included
const MIN_12M_RESALE = 3; // SPEC §4.3: <3 resale in 12m → confidence not high
const SCORE_AT_BASELINE = 5; // a project matching the baseline scores 5/10
const SCORE_PER_PP = 1; // each +1pp CAGR over baseline ≈ +1 score (×100 below)

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.25;

function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / DAY_MS;
}

function isResale(t: TxnLite): boolean {
  // URA typeOfSale: 2 = resale. Treat null as resale (older feeds omit it).
  return t.saleType === 2 || t.saleType === null;
}

/** CAGR of median PSF between the earliest and latest third of a window. */
function windowCagr(txns: TxnLite[]): number | null {
  if (txns.length < 2) return null;
  const sorted = [...txns].sort((a, b) => a.txnDate.localeCompare(b.txnDate));
  const third = Math.max(1, Math.floor(sorted.length / 3));
  const early = sorted.slice(0, third);
  const late = sorted.slice(-third);
  const earlyPsf = median(early.map((t) => t.psf));
  const latePsf = median(late.map((t) => t.psf));
  if (earlyPsf <= 0 || latePsf <= 0) return null;
  const years = daysBetween(early[0]!.txnDate, late[late.length - 1]!.txnDate) / YEAR_DAYS;
  if (years < 0.5) return null; // too short a span to annualize
  return Math.pow(latePsf / earlyPsf, 1 / years) - 1;
}

function pickRegime(
  input: ScoringInput,
  resale12m: number,
  usedSimilar: boolean
): MarketRegime | undefined {
  const snapYear = Number(input.snapshotDate.slice(0, 4));
  if (input.projectMeta.topYear && snapYear - input.projectMeta.topYear <= 1) {
    return "new_project";
  }
  if (usedSimilar) return "thin_history";
  if (resale12m >= 8) return "liquid_active";
  if (resale12m <= 2) return "tightly_held";
  return undefined;
}

export function computeProfitScore(input: ScoringInput): ProjectScore {
  const base = {
    dimension: "profit" as const,
    snapshotDate: input.snapshotDate,
    scoreVersion: SCORE_VERSION,
  };
  const cutoff = new Date(Date.parse(input.snapshotDate) - WINDOW_YEARS * YEAR_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const m12 = new Date(Date.parse(input.snapshotDate) - YEAR_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);

  const ownResale = input.transactions.filter((t) => isResale(t) && t.txnDate >= cutoff);
  const resale12m = ownResale.filter((t) => t.txnDate >= m12).length;

  // Fall back to similar projects when this project's own resale history is thin.
  let usedSimilar = false;
  let working = ownResale;
  let basisSimilar: string[] | undefined;
  if (ownResale.length < MIN_GROUP_SAMPLE && (input.similarTransactions?.length ?? 0) > 0) {
    usedSimilar = true;
    working = input.similarTransactions!.filter((t) => isResale(t) && t.txnDate >= cutoff);
    basisSimilar = input.similarProjectNames;
  }

  // No usable resale history anywhere → insufficient, do not fabricate a score.
  if (working.length === 0) {
    return {
      ...base,
      score: null,
      band: scoreToBand(null),
      confidence: "low",
      components: { resaleTxn12m: resale12m, note: "no_resale_history" },
      regime: pickRegime(input, resale12m, usedSimilar),
      basis: { txnCount: ownResale.length },
    };
  }

  // Group by bedroom type; include only groups with enough samples.
  const groups = new Map<string, TxnLite[]>();
  for (const t of working) {
    const key = t.bedroomType ?? "unknown";
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(t);
  }

  const included: { type: string; cagr: number; n: number }[] = [];
  const excluded: string[] = [];
  for (const [type, ts] of groups) {
    const cagr = ts.length >= MIN_GROUP_SAMPLE ? windowCagr(ts) : null;
    if (cagr === null) excluded.push(type);
    else included.push({ type, cagr, n: ts.length });
  }

  // If no bedroom group qualifies, fall back to the whole window as one bucket.
  let projectCagr: number | null;
  if (included.length > 0) {
    const totalN = included.reduce((s, g) => s + g.n, 0);
    projectCagr = included.reduce((s, g) => s + g.cagr * g.n, 0) / totalN;
  } else {
    projectCagr = windowCagr(working);
  }

  if (projectCagr === null) {
    return {
      ...base,
      score: null,
      band: scoreToBand(null),
      confidence: "low",
      components: { resaleTxn12m: resale12m, note: "trend_unresolved" },
      regime: pickRegime(input, resale12m, usedSimilar),
      basis: { txnCount: ownResale.length, similarProjects: basisSimilar },
    };
  }

  const deltaPp = (projectCagr - input.regionalAnnualAppreciation) * 100; // percentage points
  const score = Number(clamp(SCORE_AT_BASELINE + deltaPp * SCORE_PER_PP, 0, 10).toFixed(2));

  const confidence: Confidence = usedSimilar
    ? "estimated_similar"
    : resale12m < MIN_12M_RESALE
      ? "low"
      : "high";

  return {
    ...base,
    score,
    band: scoreToBand(score),
    confidence,
    components: {
      projectCagrPct: Number((projectCagr * 100).toFixed(2)),
      baselineCagrPct: Number((input.regionalAnnualAppreciation * 100).toFixed(2)),
      deltaPp: Number(deltaPp.toFixed(2)),
      resaleTxn12m: resale12m,
      includedBedroomTypes: included.map((g) => g.type).join(",") || "(whole-window)",
      excludedBedroomTypes: excluded.join(",") || "(none)",
    },
    regime: pickRegime(input, resale12m, usedSimilar),
    basis: { txnCount: ownResale.length, similarProjects: basisSimilar },
  };
}
