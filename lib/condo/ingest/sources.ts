/**
 * Data-source adapters for the condo ingestion pipeline.
 *
 * The pipeline depends on these interfaces, not on URA/OneMap directly — so
 * external calls are swappable and testable. Real adapters live in ./ura and
 * ./onemap; a deterministic fixture adapter (createFixtureSources) backs local
 * seed + tests without any network or API keys.
 */

import type { TxnLite, AmenityLite } from "@/lib/project-scoring";
import { regionalAppreciationLookup } from "@/lib/finance";

export interface GeocodeResult {
  lat: number;
  lng: number;
}

export interface ProjectRef {
  name: string;
  externalRef?: string | null;
}

export interface UraSource {
  /** Resale + new-sale transactions for a project (already WGS84-normalized). */
  fetchTransactions(project: ProjectRef): Promise<TxnLite[]>;
}

export interface OneMapSource {
  geocode(query: string): Promise<GeocodeResult | null>;
  fetchAmenities(loc: GeocodeResult): Promise<AmenityLite[]>;
}

export interface IngestSources {
  ura: UraSource;
  oneMap: OneMapSource;
  /** Regional appreciation baseline for the profit score. */
  regionalBaseline(district: string | null): number;
}

/** Default baseline backed by lib/finance (whole-city decade figure). */
export function defaultRegionalBaseline(district: string | null): number {
  return regionalAppreciationLookup(district ?? undefined).decade;
}

// ── Fixture adapter (local seed / tests) ────────────────────────────

export interface ProjectFixture {
  geocode: GeocodeResult;
  transactions: TxnLite[];
  amenities: AmenityLite[];
}

/**
 * Build deterministic sources from a per-project fixture map (keyed by project
 * name). Unknown projects yield empty data → the pipeline scores them
 * insufficient and leaves them as stub.
 */
export function createFixtureSources(fixtures: Record<string, ProjectFixture>): IngestSources {
  return {
    ura: {
      async fetchTransactions(project) {
        return fixtures[project.name]?.transactions ?? [];
      },
    },
    oneMap: {
      async geocode(query) {
        return fixtures[query]?.geocode ?? null;
      },
      async fetchAmenities(loc) {
        const hit = Object.values(fixtures).find(
          (f) => f.geocode.lat === loc.lat && f.geocode.lng === loc.lng
        );
        return hit?.amenities ?? [];
      },
    },
    regionalBaseline: defaultRegionalBaseline,
  };
}
