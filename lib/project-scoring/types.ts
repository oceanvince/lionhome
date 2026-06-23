/**
 * Project scoring — shared types & the single source of truth for the
 * score→band mapping. Pure module: no DB, no side effects.
 *
 * Backs the condo decision-report page (docs/CONDO_SEARCH_TD.md §5).
 * Separate from `lib/scoring/` (that is the lead-scoring stub — see SPEC §5.3).
 */

export type Dimension = "profit" | "location" | "exit" | "rental";

export type Band = "excellent" | "good" | "fair" | "poor" | "insufficient";

export type Confidence = "high" | "low" | "estimated_similar";

export type MarketRegime =
  | "liquid_active" // 流动活跃
  | "tightly_held" // 惜售
  | "thin_market" // 冷清
  | "churny" // 高换手低需求
  | "short_term_spike" // 短期冲高
  | "thin_history" // 历史薄弱
  | "weak_since_launch" // 自开盘跑输
  | "new_project"; // 新盘

/** Algorithm version — bump on any scoring-logic change (SPEC §5.4). */
export const SCORE_VERSION = "v1.0.0";

/**
 * Single source of truth for score→band thresholds (SPEC §4.2 / §5.1).
 * Both the engine and any UI must derive bands from here.
 */
export const BAND_THRESHOLDS = {
  excellent: 7,
  good: 5,
  fair: 3,
} as const;

/** Map a 0–10 score (or null) to a band. null = insufficient data. */
export function scoreToBand(score: number | null): Band {
  if (score === null) return "insufficient";
  if (score >= BAND_THRESHOLDS.excellent) return "excellent";
  if (score >= BAND_THRESHOLDS.good) return "good";
  if (score >= BAND_THRESHOLDS.fair) return "fair";
  return "poor";
}

/** Band → 中文档位（与 §4.2 文案单一来源）。 */
export const BAND_LABEL_ZH: Record<Band, string> = {
  excellent: "优秀",
  good: "良好",
  fair: "一般",
  poor: "偏弱",
  insufficient: "数据不足",
};

/** A single transaction, trimmed to what scoring needs. */
export interface TxnLite {
  txnDate: string; // ISO 'YYYY-MM-DD'
  price: number;
  areaSqft: number;
  psf: number;
  bedroomType: string | null;
  saleType: number | null; // 1 new-sale / 2 resale / 3 sub-sale (URA typeOfSale)
}

/** A single amenity. Scoring uses distance/walk; lat/lng power the map. */
export interface AmenityLite {
  kind: string; // mrt / busstop / school / mall / park ...
  name: string;
  distanceM: number | null;
  walkMinutes: number | null;
  lat?: number | null;
  lng?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Everything scoreProject() needs — plain data, fetched by the repo layer
 * (the engine itself never touches the DB). See TD §5.
 */
export interface ScoringInput {
  projectMeta: { id: string; district: string | null; topYear: number | null };
  transactions: TxnLite[]; // this project's own transactions
  similarTransactions?: TxnLite[]; // similar-project transactions (profit fallback)
  similarProjectNames?: string[]; // names of the similar projects used
  amenities: AmenityLite[];
  regionalAnnualAppreciation: number; // baseline, e.g. regionalAppreciationLookup().decade
  snapshotDate: string; // 'YYYY-MM-DD' — the data snapshot the score is pinned to
}

/** One dimension's result. Mirrors the project_scores row (TD §2.2). */
export interface ProjectScore {
  dimension: Dimension;
  score: number | null; // 0–10, null = insufficient
  band: Band;
  confidence: Confidence;
  components: Record<string, number | string | boolean>; // sub-factors →「怎么算的」
  regime?: MarketRegime;
  basis: { similarProjects?: string[]; txnCount?: number };
  snapshotDate: string;
  scoreVersion: string;
}

/** Verdict badge tier (SPEC §4.1.2). Only profit + location feed MVP verdict. */
export type VerdictTier = "green" | "amber" | "orange";

export interface Verdict {
  tier: VerdictTier;
  label: string; // 值得入候选 / 值得比较 / 谨慎比较
  sentence: string; // template-assembled, NEVER LLM (SPEC §5)
}

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Median of a numeric array (sorted copy; 0 for empty). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
