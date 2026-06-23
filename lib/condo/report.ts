/**
 * Condo report assembler — pure-ish function layer: reads via the repo,
 * assembles the CondoReport payload. No inline SQL (docs/CONDO_SEARCH_TD.md §4.1).
 */

import { buildVerdict, type AmenityLite } from "@/lib/project-scoring";
import {
  getActiveProjectBySlug,
  getLatestScores,
  getRecentTransactions,
  getAmenities,
  type DbClient,
} from "./repo";
import { type CondoReport, CONDO_DISCLAIMERS } from "./types";

const MRT_KINDS = new Set(["mrt", "mrt_station", "subway"]);

function splitAmenities(amenities: AmenityLite[]): CondoReport["amenities"] {
  const mrt: AmenityLite[] = [];
  const schools: AmenityLite[] = [];
  const other: AmenityLite[] = [];
  for (const a of amenities) {
    if (MRT_KINDS.has(a.kind)) mrt.push(a);
    else if (a.kind === "school") schools.push(a);
    else other.push(a);
  }
  // nearest MRT first
  mrt.sort((a, b) => (a.walkMinutes ?? Infinity) - (b.walkMinutes ?? Infinity));
  return { mrt, schools, other };
}

/**
 * Assemble the decision report for `slug`. Returns null when the project is
 * not published (stub/hidden/unknown) — the page then renders the cold-start
 * fallback instead of a half-baked report (SPEC §6.3).
 */
export async function getReportData(db: DbClient, slug: string): Promise<CondoReport | null> {
  const project = await getActiveProjectBySlug(db, slug);
  if (!project) return null;

  const [scores, transactions, amenities] = await Promise.all([
    getLatestScores(db, project.id),
    getRecentTransactions(db, project.id, 12),
    getAmenities(db, project.id),
  ]);

  const verdict = buildVerdict(scores);
  const snapshotDate = scores.find((s) => s.snapshotDate)?.snapshotDate ?? null;
  const scoreVersion = scores.find((s) => s.scoreVersion)?.scoreVersion ?? null;

  return {
    project,
    scores,
    verdict,
    amenities: splitAmenities(amenities),
    transactions,
    snapshotDate,
    scoreVersion,
    disclaimers: CONDO_DISCLAIMERS,
  };
}
