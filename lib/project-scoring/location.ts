/**
 * Location score — transit access + nearby primary schools + amenity
 * density, normalized & weighted (SPEC §5.2). Pure: no DB.
 */

import {
  type ProjectScore,
  type ScoringInput,
  type AmenityLite,
  SCORE_VERSION,
  scoreToBand,
  clamp,
} from "./types";

const WEIGHTS = { mrt: 0.5, school: 0.3, density: 0.2 } as const;

const MRT_KINDS = new Set(["mrt", "mrt_station", "subway"]);
const DENSITY_KINDS = new Set(["mall", "park", "busstop", "supermarket", "hawker"]);
const SCHOOL_1KM = 1000; // metres — "1km 内小学" cohort
const DENSITY_FULL = 8; // this many density POIs ≈ full marks

/** Walk minutes → 0–10: ≤5min = 10, ≥20min = 2, linear between. */
function mrtSubscore(walkMin: number): number {
  return clamp(10 - ((walkMin - 5) / 15) * 8, 2, 10);
}

/** Schools within 1km → 0–10, diminishing returns. */
function schoolSubscore(count: number): number {
  const table = [3, 6, 8, 9.5, 10]; // 0,1,2,3,4+ schools
  return table[Math.min(count, table.length - 1)]!;
}

function nearestWalk(amenities: AmenityLite[]): number | null {
  const mrt = amenities.filter((a) => MRT_KINDS.has(a.kind) && a.walkMinutes !== null);
  if (mrt.length === 0) return null;
  return Math.min(...mrt.map((a) => a.walkMinutes!));
}

export function computeLocationScore(input: ScoringInput): ProjectScore {
  const base = {
    dimension: "location" as const,
    snapshotDate: input.snapshotDate,
    scoreVersion: SCORE_VERSION,
  };
  const amenities = input.amenities;

  const walk = nearestWalk(amenities);
  const schools1km = amenities.filter(
    (a) => a.kind === "school" && a.distanceM !== null && a.distanceM <= SCHOOL_1KM
  ).length;
  const densityCount = amenities.filter((a) => DENSITY_KINDS.has(a.kind)).length;

  // Need at least transit data to score location; otherwise insufficient.
  if (walk === null && schools1km === 0 && densityCount === 0) {
    return {
      ...base,
      score: null,
      band: scoreToBand(null),
      confidence: "low",
      components: { note: "no_amenity_data" },
      basis: {},
    };
  }

  const mrtSub = walk === null ? 0 : mrtSubscore(walk);
  const schoolSub = schoolSubscore(schools1km);
  const densitySub = clamp((densityCount / DENSITY_FULL) * 10, 0, 10);

  const score = Number(
    (mrtSub * WEIGHTS.mrt + schoolSub * WEIGHTS.school + densitySub * WEIGHTS.density).toFixed(2)
  );

  return {
    ...base,
    score,
    band: scoreToBand(score),
    confidence: walk === null ? "low" : "high", // missing transit → less reliable
    components: {
      nearestMrtWalkMin: walk ?? "n/a",
      schoolsWithin1km: schools1km,
      amenityDensity: densityCount,
      mrtSubscore: Number(mrtSub.toFixed(2)),
      schoolSubscore: Number(schoolSub.toFixed(2)),
      densitySubscore: Number(densitySub.toFixed(2)),
    },
    basis: {},
  };
}
