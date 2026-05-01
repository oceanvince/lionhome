import type { ReadinessBand, ScoreResult, ScoreComponents } from "./types";

export type { ReadinessBand, ScoreResult, ScoreComponents };

/**
 * Maps a numeric score to a readiness band per PRD Section 7.4.
 */
export function bandFromScore(score: number): ReadinessBand {
  if (score >= 85) return "hot";
  if (score >= 60) return "warm";
  if (score >= 40) return "cool";
  return "cold";
}

/**
 * Stub scorer — full implementation lives with Module 2 build.
 * Kept here so dependent modules can import a stable signature.
 */
export function computeScore(components: ScoreComponents): ScoreResult {
  const score = Math.max(
    0,
    Math.min(
      100,
      components.timeline +
        components.budget_clarity +
        components.income_alignment +
        components.confidence +
        components.agent_history +
        components.concern_specificity +
        components.free_text_quality
    )
  );
  return { score, band: bandFromScore(score), components };
}
