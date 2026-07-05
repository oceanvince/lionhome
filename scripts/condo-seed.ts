/**
 * Condo cold-start backfill (one-time, manual). Seeds a handful of demo
 * projects end-to-end via deterministic fixtures — no URA/OneMap keys needed —
 * so the read path (/condo/{slug}, search, fit) has real data locally.
 *
 *   npx tsx scripts/condo-seed.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 * Re-runnable: upserts are idempotent.
 *
 * In production this same flow runs against the real adapters (createUraSource
 * / createOneMapSource) instead of fixtures — see lib/condo/ingest/pipeline.ts.
 */

import { createClient } from "@supabase/supabase-js";
import type { TxnLite, AmenityLite } from "@/lib/project-scoring";
import type { DbClient } from "@/lib/condo/repo";
import { upsertProjectBySlug } from "@/lib/condo/repo";
import { ingestProject } from "@/lib/condo/ingest/pipeline";
import { createFixtureSources, type ProjectFixture } from "@/lib/condo/ingest/sources";

// ── demo fixtures ───────────────────────────────────────────────────

interface DemoProject {
  slug: string;
  name: string;
  district: string | null;
  tenure: string | null;
  topYear: number | null;
  totalUnits: number | null;
  developer: string | null;
  fixture: ProjectFixture;
}

/** Rising resale history generator (3-bed, 1000 sqft). */
function risingResale(startPsf: number, stepPsf: number, dates: string[]): TxnLite[] {
  return dates.map((txnDate, i) => {
    const psf = startPsf + stepPsf * i;
    return { txnDate, psf, areaSqft: 1000, price: psf * 1000, bedroomType: "3", saleType: 2 };
  });
}

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

function mrtSchoolAmenities(mrtName: string, mrtWalk: number, schools: string[]): AmenityLite[] {
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

const DEMO: DemoProject[] = [
  {
    slug: "the-gazania",
    name: "The Gazania",
    district: "D19",
    tenure: "永久地契",
    topYear: 2023,
    totalUnits: 250,
    developer: "SingHaiyi",
    fixture: {
      geocode: { lat: 1.3567, lng: 103.8881 },
      transactions: risingResale(1700, 40, DATES),
      amenities: mrtSchoolAmenities("Kovan MRT", 8, ["Xinmin Primary", "Paya Lebar Methodist"]),
    },
  },
  {
    slug: "jadescape",
    name: "Jadescape",
    district: "D20",
    tenure: "99 年地契",
    topYear: 2022,
    totalUnits: 1206,
    developer: "Qingjian Realty",
    fixture: {
      geocode: { lat: 1.3552, lng: 103.8366 },
      transactions: risingResale(2050, 35, DATES),
      amenities: mrtSchoolAmenities("Marymount MRT", 4, ["Ai Tong School", "Catholic High"]),
    },
  },
  {
    slug: "normanton-park",
    name: "Normanton Park",
    district: "D05",
    tenure: "99 年地契",
    topYear: 2024,
    totalUnits: 1862,
    developer: "Kingsford",
    fixture: {
      geocode: { lat: 1.2876, lng: 103.7896 },
      transactions: risingResale(1900, 18, DATES.slice(-4)), // new project — thin history
      amenities: mrtSchoolAmenities("Kent Ridge MRT", 12, ["Pei Tong Primary"]),
    },
  },
];

// ── run ─────────────────────────────────────────────────────────────

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  const db = createClient(url, key, { auth: { persistSession: false } }) as unknown as DbClient;

  const fixtures = Object.fromEntries(DEMO.map((d) => [d.name, d.fixture]));
  const sources = createFixtureSources(fixtures);

  for (const d of DEMO) {
    const id = await upsertProjectBySlug(db, {
      slug: d.slug,
      name: d.name,
      district: d.district,
      tenure: d.tenure,
      topYear: d.topYear,
      totalUnits: d.totalUnits,
      developer: d.developer,
    });
    const res = await ingestProject(
      db,
      { id, name: d.name, district: d.district, topYear: d.topYear },
      sources
    );
    const profit = res.scores.find((s) => s.dimension === "profit");
    const location = res.scores.find((s) => s.dimension === "location");
    // eslint-disable-next-line no-console
    console.log(
      `${d.slug.padEnd(16)} promoted=${res.promoted} ` +
        `profit=${profit?.score ?? "—"} location=${location?.score ?? "—"} txns=${res.txnCount}`
    );
  }
  // eslint-disable-next-line no-console
  console.log(`\nSeeded ${DEMO.length} projects. Open /condo/the-gazania to verify.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
