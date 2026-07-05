/**
 * Search-results assembler — function layer: reads via repo, builds the
 * card list with profit score + verdict badge (SPEC §3.2). No SQL here.
 */

import { buildVerdict } from "@/lib/project-scoring";
import { listActiveProjects, getScoresForProjects, type DbClient } from "./repo";
import type { CondoCard } from "./types";

/** SPEC §6.5: the whole SG private market is ~2,500–3,000 projects — a safe
 *  upper bound for scanning the active set in memory until profit is pre-cooled
 *  onto the projects row (TD §6.1/§8). */
const MAX_SCAN = 3000;

/** Below this many published projects we are still cold-starting (SPEC §6.3). */
export const COLD_START_THRESHOLD = 30;

export type SearchFallback = "none" | "zero_result" | "cold_start";

/**
 * Decide the fallback semantics so the UI never treats an empty/half list as a
 * normal state (SPEC §3.1 / §6.3). Pure — unit-tested without a DB.
 *  - cold_start: too few projects seeded → show「按区浏览 / 留资」, not a list
 *  - zero_result: catalogue is populated but this query/filter matched nothing
 *  - none: a normal, populated result
 */
export function computeFallback(opts: {
  activeCount: number;
  resultCount: number;
  filtered: boolean;
  threshold?: number;
}): SearchFallback {
  if (opts.activeCount < (opts.threshold ?? COLD_START_THRESHOLD)) return "cold_start";
  if (opts.resultCount === 0 && opts.filtered) return "zero_result";
  return "none";
}

export async function listCards(
  db: DbClient,
  opts: { district?: string; sort?: "profit" | "psf_asc" | "top_desc"; limit?: number } = {}
): Promise<CondoCard[]> {
  const sort = opts.sort ?? "profit";
  const limit = opts.limit ?? 30;

  // psf_asc / top_desc live on the projects row, so SQL orders AND limits them
  // correctly. Profit lives in project_scores (off-row) and can't be ordered in
  // SQL here — if we let SQL limit first, we'd return the *alphabetical* top-N
  // re-sorted, not the true profit top-N. So for profit we scan the full active
  // set, then sort-then-slice in memory below.
  const sqlOrdersAndLimits = sort === "psf_asc" || sort === "top_desc";
  const projects = await listActiveProjects(db, {
    district: opts.district,
    sort,
    limit: sqlOrdersAndLimits ? limit : MAX_SCAN,
  });

  const scoresByProject = await getScoresForProjects(
    db,
    projects.map((p) => p.id)
  );

  const cards: CondoCard[] = projects.map((p) => {
    const scores = scoresByProject.get(p.id) ?? [];
    const profit = scores.find((s) => s.dimension === "profit");
    return {
      slug: p.slug,
      name: p.name,
      district: p.district,
      tenure: p.tenure,
      topYear: p.topYear,
      totalUnits: p.totalUnits,
      psfMin: p.psfMin,
      psfMax: p.psfMax,
      profitScore: profit?.score ?? null,
      profitConfidence: profit?.confidence ?? null,
      verdict: buildVerdict(scores),
    };
  });

  if (sort === "profit") {
    // Projects arrive name-sorted from SQL, so equal scores keep a stable,
    // deterministic order. Sort by profit (nulls last), THEN apply the limit.
    cards.sort((a, b) => (b.profitScore ?? -1) - (a.profitScore ?? -1));
    return cards.slice(0, limit);
  }
  return cards;
}
