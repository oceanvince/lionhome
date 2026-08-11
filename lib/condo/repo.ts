/**
 * Condo data-access layer (repo) — the ONLY place that issues supabase
 * queries for the condo feature (docs/CONDO_SEARCH_TD.md §4.1). The function
 * layer (report.ts / project-scoring) and the scoring engine never touch the
 * DB directly; they go through here.
 *
 * Callers pass the supabase client (DI): server/anon client for the read path,
 * service-role client for cron/seed writes. RLS does the rest.
 *
 * NOTE: the new condo tables are not yet in lib/supabase/database.types.ts
 * (run `npm run db:push && npm run db:types` after applying the migration).
 * Until then we use the untyped `SupabaseClient` and map rows by hand.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerClient } from "@/lib/supabase/server";
import type { ProjectScore, TxnLite, AmenityLite } from "@/lib/project-scoring";
import type { CondoProject } from "./types";
import {
  devFixturesEnabled,
  devListActiveProjects,
  devSearchActiveProjects,
  devGetScoresForProjects,
  devCountActiveProjects,
  devGetActiveProjectBySlug,
  devGetLatestScores,
  devGetRecentTransactions,
  devGetAmenities,
} from "./dev-fixtures";

/** Public boundary: callers pass the real (typed) supabase client. */
export type DbClient = ServerClient;

/**
 * Internal untyped handle — the new condo tables / columns aren't in
 * database.types.ts yet, so we query through an untyped client. Drop this
 * once `npm run db:types` regenerates the schema.
 */
function raw(db: DbClient): SupabaseClient {
  return db as unknown as SupabaseClient;
}

/**
 * Ids per `.in()` request. A uuid costs ~37 bytes in the query string, so 200
 * is ~7.4 KB — comfortably inside the 8 KB request line that proxies commonly
 * enforce, even with the rest of the URL.
 */
const ID_CHUNK_SIZE = 200;

const PROJECT_COLS =
  "id, slug, name, district, tenure, top_year, total_units, developer, lat, lng, psf_min, psf_max, psf_period_end, status";

// ── row → domain mappers ────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any): number | null {
  return v === null || v === undefined ? null : Number(v);
}

function mapProject(r: any): CondoProject {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    district: r.district ?? null,
    tenure: r.tenure ?? null,
    topYear: r.top_year ?? null,
    totalUnits: r.total_units ?? null,
    developer: r.developer ?? null,
    lat: num(r.lat),
    lng: num(r.lng),
    psfMin: num(r.psf_min),
    psfMax: num(r.psf_max),
    psfPeriodEnd: r.psf_period_end ?? null,
    status: r.status,
  };
}

function mapScore(r: any): ProjectScore {
  return {
    dimension: r.dimension,
    score: num(r.score),
    band: r.band,
    confidence: r.confidence,
    components: r.components ?? {},
    regime: r.regime ?? undefined,
    basis: r.basis ?? {},
    snapshotDate: r.data_snapshot_date,
    scoreVersion: r.score_version,
  };
}

function mapTxn(r: any): TxnLite {
  return {
    txnDate: r.txn_date,
    price: Number(r.price),
    areaSqft: Number(r.area_sqft),
    psf: Number(r.psf),
    bedroomType: r.bedroom_type ?? null,
    saleType: r.sale_type ?? null,
  };
}

function mapAmenity(r: any): AmenityLite {
  return {
    kind: r.kind,
    name: r.name,
    distanceM: num(r.distance_m),
    walkMinutes: num(r.walk_minutes),
    lat: num(r.lat),
    lng: num(r.lng),
    metadata: r.metadata ?? {},
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

// ── reads (detail page / search) ────────────────────────────────────

/** Active project by slug. Returns null for stub/hidden/unknown (SPEC §6.3). */
export async function getActiveProjectBySlug(
  db: DbClient,
  slug: string
): Promise<CondoProject | null> {
  if (devFixturesEnabled()) return devGetActiveProjectBySlug(slug);
  const { data, error } = await raw(db)
    .from("projects")
    .select(PROJECT_COLS)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  // Same rule the search path already follows (§12-⑤): a DB error is not
  // "no such project". Collapsing the two told visitors "这个盘我们还没收录"
  // during an outage — wrong, noindexed, and it loses them for good.
  if (error) throw new Error(`getActiveProjectBySlug: ${error.message}`);
  if (!data) return null;
  return mapProject(data);
}

/** Latest score per dimension (one row per dimension, newest computed_at wins). */
export async function getLatestScores(db: DbClient, projectId: string): Promise<ProjectScore[]> {
  if (devFixturesEnabled()) return devGetLatestScores(projectId);
  const { data, error } = await raw(db)
    .from("project_scores")
    .select("*")
    .eq("project_id", projectId)
    .order("computed_at", { ascending: false });
  if (error) throw new Error(`getLatestScores: ${error.message}`);
  if (!data) return [];
  const seen = new Set<string>();
  const out: ProjectScore[] = [];
  for (const row of data) {
    if (seen.has(row.dimension)) continue;
    seen.add(row.dimension);
    out.push(mapScore(row));
  }
  return out;
}

/** Resale + new-sale transactions in the last N months (default 12). */
export async function getRecentTransactions(
  db: DbClient,
  projectId: string,
  months = 12
): Promise<TxnLite[]> {
  if (devFixturesEnabled()) return devGetRecentTransactions(projectId, months);
  const { data, error } = await raw(db)
    .from("project_transactions")
    .select("*")
    .eq("project_id", projectId)
    .gte("txn_date", monthsAgoISO(months))
    .order("txn_date", { ascending: false });
  if (error) throw new Error(`getRecentTransactions: ${error.message}`);
  if (!data) return [];
  return data.map(mapTxn);
}

export async function getAmenities(db: DbClient, projectId: string): Promise<AmenityLite[]> {
  if (devFixturesEnabled()) return devGetAmenities(projectId);
  const { data, error } = await raw(db)
    .from("project_amenities")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw new Error(`getAmenities: ${error.message}`);
  if (!data) return [];
  return data.map(mapAmenity);
}

/**
 * Escape LIKE/ILIKE wildcards so user input matches literally — a bare `%` or
 * `_` would otherwise turn autocomplete into a full-table scan (test-set §12-⑥,
 * S10/X04). Postgres' default LIKE escape char is backslash.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Strip the characters PostgREST reads as structure inside `.or()`.
 *
 * `.or()` takes a comma-separated list of `column.operator.value` triples, with
 * parentheses for grouping. A term containing `,` or `()` therefore does not
 * search — it rewrites the filter. `Kovan, D19` breaks parsing and surfaces as
 * "搜索暂不可用", and `zzz,name.not.is.null` appends a condition of the
 * attacker's choosing. None of these characters carry search meaning for a
 * project name or district, so drop them before the term reaches the filter.
 * `.` is left alone: PostgREST splits a triple on the first two dots only, so a
 * dot inside the value ("St. Regis") is safe.
 */
export function sanitizeOrTerm(term: string): string {
  return term.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
}

/** Autocomplete over active projects by name / district (SPEC §3.1). */
export async function searchActiveProjects(
  db: DbClient,
  q: string,
  limit = 8
): Promise<CondoProject[]> {
  if (devFixturesEnabled()) return devSearchActiveProjects(q, limit);
  // Structural characters go first, LIKE metacharacters second — escapeLike
  // introduces backslashes that the structural pass must not see as content.
  const term = escapeLike(sanitizeOrTerm(q));
  if (!term) return [];
  const { data, error } = await raw(db)
    .from("projects")
    .select(PROJECT_COLS)
    .eq("status", "active")
    .or(`name.ilike.%${term}%,district.ilike.%${term}%`)
    .limit(limit);
  // A DB error is NOT "zero results" — surface it so the route can return
  // SEARCH_INTERNAL_ERROR instead of masking an outage as an empty list (§12-⑤).
  if (error) throw new Error(`searchActiveProjects: ${error.message}`);
  return (data ?? []).map(mapProject);
}

/** Active projects in a district, for the search-results list (SPEC §3.2). */
export async function listActiveProjects(
  db: DbClient,
  opts: { district?: string; sort?: "profit" | "psf_asc" | "top_desc"; limit?: number } = {}
): Promise<CondoProject[]> {
  if (devFixturesEnabled()) return devListActiveProjects(opts);
  let q = raw(db).from("projects").select(PROJECT_COLS).eq("status", "active");
  if (opts.district) q = q.eq("district", opts.district);
  if (opts.sort === "psf_asc") q = q.order("psf_min", { ascending: true, nullsFirst: false });
  else if (opts.sort === "top_desc")
    q = q.order("top_year", { ascending: false, nullsFirst: false });
  else q = q.order("name", { ascending: true });
  const { data, error } = await q.limit(opts.limit ?? 30);
  if (error) throw new Error(`listActiveProjects: ${error.message}`); // §12-⑤
  return (data ?? []).map(mapProject);
}

/** Count of published projects — drives the cold-start fallback (SPEC §6.3). */
export async function countActiveProjects(db: DbClient): Promise<number> {
  if (devFixturesEnabled()) return devCountActiveProjects();
  const { count, error } = await raw(db)
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (error) throw new Error(`countActiveProjects: ${error.message}`); // §12-⑤
  return count ?? 0;
}

/** Latest score per (project, dimension) for a set of projects — card verdicts. */
export async function getScoresForProjects(
  db: DbClient,
  projectIds: string[]
): Promise<Map<string, ProjectScore[]>> {
  const out = new Map<string, ProjectScore[]>();
  if (projectIds.length === 0) return out;
  if (devFixturesEnabled()) return devGetScoresForProjects(projectIds);

  // PostgREST renders `.in()` into the query string, so asking for the whole
  // profit scan set in one call (up to MAX_SCAN = 3000 uuids, ~110 KB of URL)
  // is rejected by the proxies in front of it — a 414/500 that only shows up
  // once the catalogue reaches the size this sort was built for. Chunked, each
  // request stays well inside the limit. Ids are unique, so a project lands in
  // exactly one chunk and the newest-wins pass below is unaffected.
  const chunks: string[][] = [];
  for (let i = 0; i < projectIds.length; i += ID_CHUNK_SIZE) {
    chunks.push(projectIds.slice(i, i + ID_CHUNK_SIZE));
  }

  const responses = await Promise.all(
    chunks.map((chunk) =>
      raw(db)
        .from("project_scores")
        .select("*")
        .in("project_id", chunk)
        .order("computed_at", { ascending: false })
    )
  );

  const seen = new Set<string>(); // project_id|dimension → keep newest
  for (const { data, error } of responses) {
    if (error) throw new Error(`getScoresForProjects: ${error.message}`); // §12-⑤
    for (const row of data ?? []) {
      const k = `${row.project_id}|${row.dimension}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const arr = out.get(row.project_id) ?? [];
      arr.push(mapScore(row));
      out.set(row.project_id, arr);
    }
  }
  return out;
}

/** Projects the pipeline should (re)ingest — active (refresh) + stub (promote). */
export async function listIngestTargets(
  db: DbClient
): Promise<{ id: string; name: string; district: string | null; topYear: number | null }[]> {
  const { data, error } = await raw(db)
    .from("projects")
    .select("id, name, district, top_year")
    .in("status", ["active", "stub"]);
  if (error || !data) return [];
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    district: r.district ?? null,
    topYear: r.top_year ?? null,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

// ── writes (cron / seed; service-role client) ───────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function upsertTransactions(
  db: DbClient,
  projectId: string,
  txns: TxnLite[]
): Promise<void> {
  if (txns.length === 0) return;
  const rows = txns.map((t) => ({
    project_id: projectId,
    txn_date: t.txnDate,
    price: t.price,
    area_sqft: t.areaSqft,
    psf: t.psf,
    bedroom_type: t.bedroomType,
    sale_type: t.saleType,
  }));
  const { error } = await (raw(db).from("project_transactions") as any).upsert(rows, {
    onConflict: "project_id,txn_date,area_sqft,price",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`upsertTransactions: ${error.message}`);
}

export async function upsertScores(
  db: DbClient,
  projectId: string,
  scores: ProjectScore[]
): Promise<void> {
  const rows = scores.map((s) => ({
    project_id: projectId,
    dimension: s.dimension,
    score: s.score,
    band: s.band,
    confidence: s.confidence,
    components: s.components,
    regime: s.regime ?? null,
    basis: s.basis,
    data_snapshot_date: s.snapshotDate,
    score_version: s.scoreVersion,
  }));
  const { error } = await (raw(db).from("project_scores") as any).upsert(rows, {
    onConflict: "project_id,dimension,score_version",
  });
  if (error) throw new Error(`upsertScores: ${error.message}`);
}

/** Recompute and cache the 12-month PSF range on the projects row. */
export async function refreshPsfRange(db: DbClient, projectId: string): Promise<void> {
  const txns = await getRecentTransactions(db, projectId, 12);
  if (txns.length === 0) return;
  const psfs = txns.map((t) => t.psf).sort((a, b) => a - b);
  const { error } = await (raw(db).from("projects") as any)
    .update({
      psf_min: psfs[0],
      psf_max: psfs[psfs.length - 1],
      psf_period_end: new Date().toISOString().slice(0, 10),
    })
    .eq("id", projectId);
  if (error) throw new Error(`refreshPsfRange: ${error.message}`);
}

/** Promote a fully-prepared project to public (SPEC §6.3 cold-start gate). */
export async function setProjectStatus(
  db: DbClient,
  projectId: string,
  status: "active" | "hidden" | "stub"
): Promise<void> {
  const { error } = await (raw(db).from("projects") as any).update({ status }).eq("id", projectId);
  if (error) throw new Error(`setProjectStatus: ${error.message}`);
}

/** Append a data-correction report (SPEC §7.2). anon-insertable. */
export async function insertDataFeedback(
  db: DbClient,
  input: { projectId: string; dimension?: string | null; userNote: string; contact?: string | null }
): Promise<void> {
  const { error } = await (raw(db).from("project_data_feedback") as any).insert({
    project_id: input.projectId,
    dimension: input.dimension ?? null,
    user_note: input.userNote,
    contact: input.contact ?? null,
  });
  if (error) throw new Error(`insertDataFeedback: ${error.message}`);
}

/** Full-refresh a project's amenities (geo data is replaced, not merged). */
export async function upsertAmenities(
  db: DbClient,
  projectId: string,
  amenities: AmenityLite[]
): Promise<void> {
  // Check before deleting, not after. There is no transaction around
  // delete+insert, so an empty set used to clear the project's amenities
  // permanently — a transient OneMap failure was enough to erase its MRT and
  // school data. Leaving the previous rows in place is the safer failure mode:
  // stale beats gone, and callers that genuinely have zero simply keep the last
  // known set until a successful fetch replaces it.
  if (amenities.length === 0) return;
  await (raw(db).from("project_amenities") as any).delete().eq("project_id", projectId);
  const rows = amenities.map((a) => ({
    project_id: projectId,
    kind: a.kind,
    name: a.name,
    lat: a.lat ?? null,
    lng: a.lng ?? null,
    distance_m: a.distanceM,
    walk_minutes: a.walkMinutes,
    metadata: a.metadata ?? {},
  }));
  const { error } = await (raw(db).from("project_amenities") as any).insert(rows);
  if (error) throw new Error(`upsertAmenities: ${error.message}`);
}

/** Update a project's geocoded coordinates. */
export async function updateProjectGeo(
  db: DbClient,
  projectId: string,
  lat: number,
  lng: number
): Promise<void> {
  const { error } = await (raw(db).from("projects") as any)
    .update({ lat, lng })
    .eq("id", projectId);
  if (error) throw new Error(`updateProjectGeo: ${error.message}`);
}

/** Insert (or fetch) a project by slug, returning its id. Used by seed/backfill. */
export async function upsertProjectBySlug(
  db: DbClient,
  p: {
    slug: string;
    name: string;
    district: string | null;
    tenure: string | null;
    topYear: number | null;
    totalUnits: number | null;
    developer: string | null;
    externalRef?: string | null;
  }
): Promise<string> {
  const { data, error } = await (raw(db).from("projects") as any)
    .upsert(
      {
        slug: p.slug,
        name: p.name,
        district: p.district,
        tenure: p.tenure,
        top_year: p.topYear,
        total_units: p.totalUnits,
        developer: p.developer,
        external_ref: p.externalRef ?? null,
        status: "stub", // promoted to active by the pipeline once data is ready
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`upsertProjectBySlug: ${error?.message ?? "no id"}`);
  return data.id as string;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
