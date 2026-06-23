/**
 * Search-results assembler — function layer: reads via repo, builds the
 * card list with profit score + verdict badge (SPEC §3.2). No SQL here.
 */

import { buildVerdict } from "@/lib/project-scoring";
import { listActiveProjects, getScoresForProjects, type DbClient } from "./repo";
import type { CondoCard } from "./types";

export async function listCards(
  db: DbClient,
  opts: { district?: string; sort?: "profit" | "psf_asc" | "top_desc"; limit?: number } = {}
): Promise<CondoCard[]> {
  const projects = await listActiveProjects(db, opts);
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

  // Profit lives in scores, not on the projects row, so sort it here.
  if (opts.sort === "profit") {
    cards.sort((a, b) => (b.profitScore ?? -1) - (a.profitScore ?? -1));
  }
  return cards;
}
