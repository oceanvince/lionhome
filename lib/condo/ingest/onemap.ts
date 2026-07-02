/**
 * OneMap adapter — geocoding + nearby amenities.
 *
 * - geocode: GET /api/common/elastic/search (public, no token) → WGS84 lat/lng.
 * - fetchAmenities: use the public OneMap search endpoint to pull Singapore-wide
 *   "MRT STATION" and "PRIMARY SCHOOL" results, then filter by distance around
 *   the project. This avoids relying on OneMap theme query names, which do not
 *   currently expose MRT/school POI layers in the available theme catalog.
 *
 * Auth: geocoding and POI search are public; no OneMap token is required for
 * the MVP location score.
 */

import type { AmenityLite } from "@/lib/project-scoring";
import type { OneMapSource, GeocodeResult } from "./sources";

const SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
const WALK_M_PER_MIN = 80; // ~4.8 km/h walking pace
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

export function clearOneMapSearchCacheForTests(): void {
  searchCatalogCache.clear();
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

async function fetchNearbySearchPois(loc: GeocodeResult): Promise<AmenityLite[]> {
  const groups: AmenityLite[][] = [];
  for (const { kind, query, radiusM } of POI_SEARCHES) {
    const rows = await fetchAllSearchResults(query);
    groups.push(mapSearchResults(kind, loc, rows, radiusM));
    await sleep(PAGE_DELAY_MS);
  }
  return dedupeAmenities(groups.flat());
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
