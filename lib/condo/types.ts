/**
 * Condo read-path domain types — the shape the detail page consumes.
 * See docs/CONDO_SEARCH_TD.md §4.1.
 */

import type { ProjectScore, Verdict, TxnLite, AmenityLite } from "@/lib/project-scoring";

export interface CondoProject {
  id: string;
  slug: string;
  name: string;
  district: string | null;
  tenure: string | null;
  topYear: number | null;
  totalUnits: number | null;
  developer: string | null;
  lat: number | null;
  lng: number | null;
  psfMin: number | null;
  psfMax: number | null;
  psfPeriodEnd: string | null;
  status: string;
}

/** Card-level preview for search results (SPEC §3.2). */
export interface CondoCard {
  slug: string;
  name: string;
  district: string | null;
  tenure: string | null;
  topYear: number | null;
  totalUnits: number | null;
  psfMin: number | null;
  psfMax: number | null;
  profitScore: number | null;
  profitConfidence: ProjectScore["confidence"] | null;
  verdict: Verdict;
}

/** Full decision report (SPEC §4). Assembled by lib/condo/report.ts. */
export interface CondoReport {
  project: CondoProject;
  scores: ProjectScore[];
  verdict: Verdict;
  amenities: { mrt: AmenityLite[]; schools: AmenityLite[]; other: AmenityLite[] };
  transactions: TxnLite[];
  snapshotDate: string | null;
  scoreVersion: string | null;
  disclaimers: string[];
}

/** Compliance copy that must stay resident on the report (SPEC §11). */
export const CONDO_DISCLAIMERS = [
  "本页分数与结论由公开数据（URA / OneMap / MOE / data.gov.sg）按既定方法论计算，仅供参考，不构成估价、投资建议或受 CEA 监管的物业咨询。",
  "价格均为近 12 月成交 PSF 区间的算术换算，非估价。请在决策前咨询持牌专业人士。",
];
