/**
 * Project scoring engine — orchestration.
 *
 * `scoreProject` is a PURE function: plain data in, ProjectScore[] out, no DB.
 * Persistence (writing project_scores) happens in the cron layer via the repo
 * (docs/CONDO_SEARCH_TD.md §5/§6). The same input + snapshotDate is fully
 * deterministic, so the golden-sample CI regression (SPEC §13) can pin it.
 */

import { type ProjectScore, type ScoringInput, type Dimension, SCORE_VERSION } from "./types";
import { computeProfitScore } from "./profit";
import { computeLocationScore } from "./location";

export * from "./types";
export { computeProfitScore } from "./profit";
export { computeLocationScore } from "./location";
export { buildVerdict } from "./verdict";
export { isSimilarProject, type ProjectClusterKey } from "./similar";

/** Exit / Rental are MVP placeholders — greyed-out「即将上线」, excluded from verdict. */
function comingSoon(dimension: Dimension, snapshotDate: string): ProjectScore {
  return {
    dimension,
    score: null,
    band: "insufficient",
    confidence: "low",
    components: { status: "coming_soon" },
    basis: {},
    snapshotDate,
    scoreVersion: SCORE_VERSION,
  };
}

/**
 * Score all four dimensions for one project. profit + location are computed;
 * exit + rental return「即将上线」placeholders until V2.1.
 */
export function scoreProject(input: ScoringInput): ProjectScore[] {
  return [
    computeProfitScore(input),
    computeLocationScore(input),
    comingSoon("exit", input.snapshotDate),
    comingSoon("rental", input.snapshotDate),
  ];
}
