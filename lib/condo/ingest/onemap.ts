/**
 * OneMap adapter — geocoding + amenity themes + walking time.
 *
 * SKELETON: HTTP calls stubbed with TODOs. Wiring needed:
 *   1. geocode: GET /api/common/elastic/search?searchVal=&returnGeom=Y → LAT/LONG.
 *   2. fetchAmenities: GET /api/public/themesvc/retrieveTheme for mrt/school/...
 *      themes near the location; compute distance; optionally Routing API for
 *      walking minutes to the nearest MRT.
 *
 * Env: ONEMAP_TOKEN (some endpoints require auth). Until configured, methods
 * throw so the pipeline degrades visibly rather than scoring on empty data.
 */

import type { AmenityLite } from "@/lib/project-scoring";
import type { OneMapSource, GeocodeResult } from "./sources";

const ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
// const ONEMAP_THEME_URL = "https://www.onemap.gov.sg/api/public/themesvc/retrieveTheme";

export function createOneMapSource(): OneMapSource {
  return {
    async geocode(query: string): Promise<GeocodeResult | null> {
      // TODO: GET ONEMAP_SEARCH_URL?searchVal=<query>&returnGeom=Y&getAddrDetails=Y
      //       → results[0].LATITUDE / LONGITUDE (WGS84).
      void ONEMAP_SEARCH_URL;
      void query;
      throw new Error("OneMap geocode not implemented");
    },

    async fetchAmenities(loc: GeocodeResult): Promise<AmenityLite[]> {
      // TODO: retrieve mrt/school/mall/park themes near `loc`, compute distance_m,
      //       and walking minutes (Routing API) for the nearest MRT. Map each to
      //       AmenityLite { kind, name, lat, lng, distanceM, walkMinutes }.
      void loc;
      throw new Error("OneMap amenities not implemented");
    },
  };
}
