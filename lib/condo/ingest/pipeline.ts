/**
 * Ingestion pipeline — orchestrates one project end-to-end:
 *   geocode → transactions → PSF range → amenities → score → promote.
 *
 * The same code backs the one-time backfill (scripts/condo-seed.ts) and the
 * nightly cron — only the date window / source differs. DB writes go through
 * the repo (DI via `repo` param, so this is unit-testable without a DB).
 */

import { scoreProject, type ProjectScore, type ScoringInput } from "@/lib/project-scoring";
import * as defaultRepo from "../repo";
import type { DbClient } from "../repo";
import type { IngestSources } from "./sources";

export interface IngestableProject {
  id: string;
  name: string;
  district: string | null;
  topYear: number | null;
  externalRef?: string | null;
}

/** Subset of the repo the pipeline writes through (DI seam for tests). */
export interface IngestRepo {
  upsertTransactions: typeof defaultRepo.upsertTransactions;
  refreshPsfRange: typeof defaultRepo.refreshPsfRange;
  upsertAmenities: typeof defaultRepo.upsertAmenities;
  updateProjectGeo: typeof defaultRepo.updateProjectGeo;
  upsertScores: typeof defaultRepo.upsertScores;
  setProjectStatus: typeof defaultRepo.setProjectStatus;
}

/**
 * Cold-start gate (SPEC §6.3): only publish a project once at least one of
 * profit / location has a real (non-null) score — never a half-baked report.
 */
export function shouldPromote(scores: ProjectScore[]): boolean {
  return scores.some(
    (s) => (s.dimension === "profit" || s.dimension === "location") && s.score !== null
  );
}

export interface IngestResult {
  projectId: string;
  scores: ProjectScore[];
  promoted: boolean;
  txnCount: number;
}

export async function ingestProject(
  db: DbClient,
  project: IngestableProject,
  sources: IngestSources,
  opts: { snapshotDate?: string; repo?: IngestRepo } = {}
): Promise<IngestResult> {
  const repo = opts.repo ?? defaultRepo;
  const snapshotDate = opts.snapshotDate ?? new Date().toISOString().slice(0, 10);

  // 1. geocode (best-effort — location score degrades gracefully if missing)
  const loc = await sources.oneMap.geocode(project.name).catch(() => null);
  if (loc) await repo.updateProjectGeo(db, project.id, loc.lat, loc.lng);

  // 2. transactions → PSF range
  const transactions = await sources.ura.fetchTransactions(project).catch(() => []);
  await repo.upsertTransactions(db, project.id, transactions);
  await repo.refreshPsfRange(db, project.id);

  // 3. amenities
  const amenities = loc ? await sources.oneMap.fetchAmenities(loc).catch(() => []) : [];
  await repo.upsertAmenities(db, project.id, amenities);

  // 4. score (pure)
  const input: ScoringInput = {
    projectMeta: { id: project.id, district: project.district, topYear: project.topYear },
    transactions,
    amenities,
    regionalAnnualAppreciation: sources.regionalBaseline(project.district),
    snapshotDate,
  };
  const scores = scoreProject(input);
  await repo.upsertScores(db, project.id, scores);

  // 5. promote when data is ready
  const promoted = shouldPromote(scores);
  if (promoted) await repo.setProjectStatus(db, project.id, "active");

  return { projectId: project.id, scores, promoted, txnCount: transactions.length };
}
