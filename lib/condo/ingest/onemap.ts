/**
 * OneMap adapter — geocoding + nearby amenities.
 *
 * - geocode: GET /api/common/elastic/search (public, no token) → WGS84 lat/lng.
 * - fetchAmenities: use the public OneMap search endpoint to pull Singapore-wide
 *   "MRT STATION" and "PRIMARY SCHOOL" results, then filter by distance around
 *   the project. This avoids relying on OneMap theme query names, which do not
 *   currently expose MRT/school POI layers in the available theme catalog.
 * - MRT walkMinutes: enriched with the OneMap Routing API (routeType=walk),
 *   which returns the real pedestrian-network walking time instead of a
 *   straight-line estimate. Routing requires a token, so we fall back to the
 *   haversine estimate when credentials are missing or a route call fails.
 *
 * Auth: geocoding and POI search are public (no token). The routing service
 * needs a token obtained from ONEMAP_EMAIL / ONEMAP_PASSWORD via getToken; when
 * those are unset the adapter still works, using the straight-line estimate.
 */

import type { AmenityLite } from "@/lib/project-scoring";
import type { OneMapSource, GeocodeResult } from "./sources";

const SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
const TOKEN_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const ROUTE_URL = "https://www.onemap.gov.sg/api/public/routingsvc/route";
const WALK_M_PER_MIN = 80; // ~4.8 km/h walking pace — straight-line fallback only
const BOX_M = 1500; // half-extent of the search box around the project
const MAX_SEARCH_PAGES = 100; // OneMap returns 10 rows/page; enough for full MRT/school catalogs.
const PAGE_DELAY_MS = 100; // OneMap public search is rate-limited; keep catalog pulls gentle.
const FETCH_TIMEOUT_MS = 12_000;

const POI_SEARCHES: { kind: "mrt" | "school"; query: string; radiusM: number }[] = [
  { kind: "mrt", query: "MRT STATION", radiusM: BOX_M },
  { kind: "school", query: "PRIMARY SCHOOL", radiusM: 1000 },
];

/* eslint-disable @typescript-eslint/no-explicit-any */

const searchCatalogCache = new Map<string, Promise<any[]>>();
let tokenCache: { token: string; expiresAtMs: number } | null = null;

export function clearOneMapSearchCacheForTests(): void {
  searchCatalogCache.clear();
  tokenCache = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Great-circle distance in metres between two WGS84 points. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/** Map OneMap search results → AmenityLite[], optionally filtering by radius. */
export function mapSearchResults(
  kind: "mrt" | "school",
  loc: GeocodeResult,
  results: any[],
  radiusM: number
): AmenityLite[] {
  const out: AmenityLite[] = [];
  for (const r of results ?? []) {
    const lat = Number(r?.LATITUDE);
    const lng = Number(r?.LONGITUDE);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const distanceM = haversineMeters(loc, { lat, lng });
    if (distanceM > radiusM) continue;
    out.push({
      kind,
      name: String(r?.BUILDING || r?.SEARCHVAL || r?.ADDRESS || kind),
      lat,
      lng,
      distanceM,
      // Straight-line seed; MRT is later overridden with the real walking
      // time from the routing service (see enrichMrtWalkMinutes).
      walkMinutes: kind === "mrt" ? Math.max(1, Math.round(distanceM / WALK_M_PER_MIN)) : null,
    });
  }
  return out;
}

async function fetchSearchPage(query: string, pageNum: number, attempt = 0): Promise<any> {
  const url = `${SEARCH_URL}?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=${pageNum}`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timeout));
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await sleep(1_000 * 2 ** attempt);
    return fetchSearchPage(query, pageNum, attempt + 1);
  }
  if (!res.ok) throw new Error(`OneMap search ${query} page ${pageNum} HTTP ${res.status}`);
  return res.json();
}

async function fetchAllSearchResults(query: string): Promise<any[]> {
  const cached = searchCatalogCache.get(query);
  if (cached) return cached;

  const promise = fetchAllSearchResultsUncached(query);
  searchCatalogCache.set(query, promise);
  return promise;
}

async function fetchAllSearchResultsUncached(query: string): Promise<any[]> {
  const first = await fetchSearchPage(query, 1);
  const found = Number(first?.found ?? first?.totalNumPages ?? 0);
  const totalPages =
    Number(first?.totalNumPages) ||
    (Number.isFinite(found) && found > 0 ? Math.ceil(found / 10) : 1);
  const pageCount = Math.min(Math.max(totalPages, 1), MAX_SEARCH_PAGES);
  const pages = [first];
  for (let page = 2; page <= pageCount; page += 1) {
    await sleep(PAGE_DELAY_MS);
    pages.push(await fetchSearchPage(query, page));
  }
  return pages.flatMap((json) => (json?.results as any[]) ?? []);
}

function dedupeAmenities(items: AmenityLite[]): AmenityLite[] {
  const seen = new Set<string>();
  const out: AmenityLite[] = [];
  for (const item of items.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))) {
    const key = `${item.kind}|${item.name}|${item.lat?.toFixed(6)}|${item.lng?.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Obtain a OneMap routing token from ONEMAP_EMAIL / ONEMAP_PASSWORD, cached
 * until shortly before its expiry. Returns null when credentials are unset — the
 * caller then keeps the straight-line walk estimate instead of failing.
 */
async function getRoutingToken(): Promise<string | null> {
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) return null;

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) return tokenCache.token;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: ctrl.signal,
  }).finally(() => clearTimeout(timeout));
  if (!res.ok) throw new Error(`OneMap getToken HTTP ${res.status}`);
  const json: any = await res.json();
  const token = json?.access_token;
  if (!token) throw new Error("OneMap getToken: no access_token in response");
  // expiry_timestamp is unix seconds (string); default to ~2h if absent.
  const expirySec = Number(json?.expiry_timestamp);
  const expiresAtMs =
    Number.isFinite(expirySec) && expirySec > 0 ? expirySec * 1000 : now + 2 * 3_600_000;
  tokenCache = { token, expiresAtMs };
  return token;
}

/**
 * Real pedestrian-network walking time (minutes) between two points via the
 * OneMap Routing API. Returns null on any failure so the caller can fall back.
 */
export async function fetchWalkMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  token: string
): Promise<number | null> {
  const url = `${ROUTE_URL}?start=${from.lat},${from.lng}&end=${to.lat},${to.lng}&routeType=walk`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(url, {
    headers: { Authorization: token },
    signal: ctrl.signal,
  }).finally(() => clearTimeout(timeout));
  if (!res.ok) return null;
  const json: any = await res.json();
  const seconds = Number(json?.route_summary?.total_time);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Override each MRT amenity's walkMinutes with the real routing-service walking
 * time. Best-effort: without a token (or if a route call fails) the amenity
 * keeps its straight-line seed from mapSearchResults.
 */
async function enrichMrtWalkMinutes(
  loc: GeocodeResult,
  amenities: AmenityLite[]
): Promise<AmenityLite[]> {
  const token = await getRoutingToken().catch(() => null);
  if (!token) return amenities;

  for (const a of amenities) {
    if (a.kind !== "mrt" || a.lat == null || a.lng == null) continue;
    const real = await fetchWalkMinutes(loc, { lat: a.lat, lng: a.lng }, token).catch(() => null);
    if (real != null) a.walkMinutes = real;
    await sleep(PAGE_DELAY_MS);
  }
  return amenities;
}

async function fetchNearbySearchPois(loc: GeocodeResult): Promise<AmenityLite[]> {
  const groups: AmenityLite[][] = [];
  for (const { kind, query, radiusM } of POI_SEARCHES) {
    const rows = await fetchAllSearchResults(query);
    groups.push(mapSearchResults(kind, loc, rows, radiusM));
    await sleep(PAGE_DELAY_MS);
  }
  const amenities = dedupeAmenities(groups.flat());
  return enrichMrtWalkMinutes(loc, amenities);
}

export function createOneMapSource(): OneMapSource {
  return {
    async geocode(query: string): Promise<GeocodeResult | null> {
      const url = `${SEARCH_URL}?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OneMap geocode HTTP ${res.status}`);
      const json: any = await res.json();
      const hit = json?.results?.[0];
      if (!hit?.LATITUDE || !hit?.LONGITUDE) return null;
      const lat = Number(hit.LATITUDE);
      const lng = Number(hit.LONGITUDE);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    },

    async fetchAmenities(loc: GeocodeResult): Promise<AmenityLite[]> {
      return fetchNearbySearchPois(loc);
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
