/**
 * DEV-ONLY in-memory condo fixtures so the search API works without a database.
 *
 * Mirrors the three demo projects from scripts/condo-seed.ts and computes REAL
 * scores via the scoring engine, so sort / verdict / fallback behave like prod.
 * The repo read functions short-circuit to these when CONDO_DEV_FIXTURES=1
 * (see lib/condo/repo.ts). Never enabled in production.
 *
 * countActiveProjects defaults to a "populated" value (CONDO_DEV_ACTIVE_COUNT,
 * default 50) so the none/zero_result fallback paths are reachable with only 3
 * fixtures; set CONDO_DEV_ACTIVE_COUNT below 30 to exercise cold_start.
 */
import {
  scoreProject,
  type ProjectScore,
  type TxnLite,
  type AmenityLite,
} from "@/lib/project-scoring";
import { regionalAppreciationLookup } from "@/lib/finance";
import type { CondoProject } from "./types";

export function devFixturesEnabled(): boolean {
  return process.env.CONDO_DEV_FIXTURES === "1";
}

const SNAPSHOT = "2026-06-01";
const DATES = [
  "2024-08-01",
  "2024-11-01",
  "2025-02-01",
  "2025-05-01",
  "2025-08-01",
  "2025-11-01",
  "2026-02-01",
  "2026-05-01",
];

function risingResale(startPsf: number, stepPsf: number, dates: string[]): TxnLite[] {
  return dates.map((txnDate, i) => {
    const psf = startPsf + stepPsf * i;
    return { txnDate, psf, areaSqft: 1000, price: psf * 1000, bedroomType: "3", saleType: 2 };
  });
}

function amenities(mrtName: string, mrtWalk: number, schools: string[]): AmenityLite[] {
  return [
    {
      kind: "mrt",
      name: mrtName,
      distanceM: mrtWalk * 75,
      walkMinutes: mrtWalk,
      lat: null,
      lng: null,
    },
    ...schools.map((name) => ({
      kind: "school",
      name,
      distanceM: 800,
      walkMinutes: null,
      lat: null,
      lng: null,
    })),
    { kind: "mall", name: "Nearby Mall", distanceM: 700, walkMinutes: 9, lat: null, lng: null },
    { kind: "park", name: "Nearby Park", distanceM: 500, walkMinutes: 6, lat: null, lng: null },
  ];
}

interface Fixture {
  project: CondoProject;
  transactions: TxnLite[];
  amenities: AmenityLite[];
}

function build(
  meta: Omit<CondoProject, "id" | "psfMin" | "psfMax" | "psfPeriodEnd" | "status">,
  transactions: TxnLite[],
  ams: AmenityLite[]
): Fixture {
  const psfs = transactions.map((t) => t.psf).sort((a, b) => a - b);
  const project: CondoProject = {
    ...meta,
    id: `dev-${meta.slug}`,
    psfMin: psfs[0] ?? null,
    psfMax: psfs[psfs.length - 1] ?? null,
    psfPeriodEnd: SNAPSHOT,
    status: "active",
  };
  return { project, transactions, amenities: ams };
}

const FIXTURES: Fixture[] = [
  build(
    {
      slug: "the-gazania",
      name: "The Gazania",
      district: "D19",
      tenure: "永久地契",
      topYear: 2023,
      totalUnits: 250,
      developer: "SingHaiyi",
      lat: 1.3567,
      lng: 103.8881,
    },
    risingResale(1700, 40, DATES),
    amenities("Kovan MRT", 8, ["Xinmin Primary", "Paya Lebar Methodist"])
  ),
  build(
    {
      slug: "jadescape",
      name: "Jadescape",
      district: "D20",
      tenure: "99 年地契",
      topYear: 2022,
      totalUnits: 1206,
      developer: "Qingjian Realty",
      lat: 1.3552,
      lng: 103.8366,
    },
    risingResale(2050, 35, DATES),
    amenities("Marymount MRT", 4, ["Ai Tong School", "Catholic High"])
  ),
  build(
    {
      slug: "normanton-park",
      name: "Normanton Park",
      district: "D05",
      tenure: "99 年地契",
      topYear: 2024,
      totalUnits: 1862,
      developer: "Kingsford",
      lat: 1.2876,
      lng: 103.7896,
    },
    risingResale(1900, 18, DATES.slice(-4)), // new project — thin history
    amenities("Kent Ridge MRT", 12, ["Pei Tong Primary"])
  ),
];

function scoresFor(f: Fixture): ProjectScore[] {
  return scoreProject({
    projectMeta: { id: f.project.id, district: f.project.district, topYear: f.project.topYear },
    transactions: f.transactions,
    amenities: f.amenities,
    regionalAnnualAppreciation: regionalAppreciationLookup(f.project.district ?? undefined).decade,
    snapshotDate: SNAPSHOT,
  });
}

const PROJECTS: CondoProject[] = FIXTURES.map((f) => f.project);
const SCORES = new Map<string, ProjectScore[]>(FIXTURES.map((f) => [f.project.id, scoresFor(f)]));

export function devListActiveProjects(
  opts: { district?: string; sort?: "profit" | "psf_asc" | "top_desc"; limit?: number } = {}
): CondoProject[] {
  let rows = PROJECTS.filter((p) => !opts.district || p.district === opts.district);
  if (opts.sort === "psf_asc")
    rows = [...rows].sort((a, b) => (a.psfMin ?? Infinity) - (b.psfMin ?? Infinity));
  else if (opts.sort === "top_desc")
    rows = [...rows].sort((a, b) => (b.topYear ?? -Infinity) - (a.topYear ?? -Infinity));
  else rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return rows.slice(0, opts.limit ?? 30);
}

export function devSearchActiveProjects(q: string, limit = 8): CondoProject[] {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return PROJECTS.filter(
    (p) => p.name.toLowerCase().includes(term) || (p.district ?? "").toLowerCase().includes(term)
  ).slice(0, limit);
}

export function devGetScoresForProjects(ids: string[]): Map<string, ProjectScore[]> {
  const out = new Map<string, ProjectScore[]>();
  for (const id of ids) {
    const s = SCORES.get(id);
    if (s) out.set(id, s);
  }
  return out;
}

export function devCountActiveProjects(): number {
  return Number(process.env.CONDO_DEV_ACTIVE_COUNT ?? 50);
}
