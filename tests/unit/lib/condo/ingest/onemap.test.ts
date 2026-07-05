/**
 * OneMap adapter — geometry helpers + parsing (no live API). Source tested
 * against a mocked global fetch.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  haversineMeters,
  mapSearchResults,
  createOneMapSource,
  clearOneMapSearchCacheForTests,
} from "@/lib/condo/ingest/onemap";

describe("haversineMeters", () => {
  it("is ~0 for the same point and ~111km for 1° latitude", () => {
    expect(haversineMeters({ lat: 1.3, lng: 103.8 }, { lat: 1.3, lng: 103.8 })).toBe(0);
    const oneDeg = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(oneDeg).toBeGreaterThan(110_000);
    expect(oneDeg).toBeLessThan(112_000);
  });
});

describe("mapSearchResults", () => {
  const loc = { lat: 1.3567, lng: 103.8881 };
  it("parses OneMap search rows, filters by radius, and sets MRT walk minutes", () => {
    const out = mapSearchResults(
      "mrt",
      loc,
      [
        {
          SEARCHVAL: "KOVAN MRT STATION",
          BUILDING: "KOVAN MRT STATION",
          LATITUDE: "1.3601",
          LONGITUDE: "103.8852",
        },
        { SEARCHVAL: "FAR MRT STATION", LATITUDE: "1.1", LONGITUDE: "103.1" },
      ],
      1500
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("mrt");
    expect(out[0]!.name).toBe("KOVAN MRT STATION");
    expect(out[0]!.distanceM).toBeGreaterThan(0);
    expect(out[0]!.walkMinutes).toBeGreaterThanOrEqual(1);
  });
  it("leaves walkMinutes null for school rows", () => {
    const out = mapSearchResults(
      "school",
      loc,
      [{ SEARCHVAL: "XINMIN PRIMARY SCHOOL", LATITUDE: "1.357", LONGITUDE: "103.889" }],
      1000
    );
    expect(out[0]!.walkMinutes).toBeNull();
  });
});

describe("createOneMapSource (mocked fetch)", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    clearOneMapSearchCacheForTests();
    vi.restoreAllMocks();
  });
  beforeEach(clearOneMapSearchCacheForTests);

  it("geocode returns WGS84 from the first search result (no token needed)", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [{ LATITUDE: "1.3567", LONGITUDE: "103.8881" }] }),
    })) as unknown as typeof fetch;
    const loc = await createOneMapSource().geocode("The Gazania");
    expect(loc).toEqual({ lat: 1.3567, lng: 103.8881 });
  });

  it("fetchAmenities uses public search results for nearby MRT and primary schools", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      const query = u.searchParams.get("searchVal");
      const page = Number(u.searchParams.get("pageNum"));
      if (query === "MRT STATION") {
        return {
          ok: true,
          json: async () => ({
            found: 1,
            totalNumPages: 1,
            results: [
              {
                SEARCHVAL: "KOVAN MRT STATION",
                BUILDING: "KOVAN MRT STATION",
                LATITUDE: "1.3601",
                LONGITUDE: "103.8852",
              },
            ],
          }),
        } as Response;
      }
      if (query === "PRIMARY SCHOOL") {
        return {
          ok: true,
          json: async () => ({
            found: 1,
            totalNumPages: 1,
            results: [
              {
                SEARCHVAL: "XINMIN PRIMARY SCHOOL",
                BUILDING: "XINMIN PRIMARY SCHOOL",
                LATITUDE: "1.357",
                LONGITUDE: "103.889",
              },
            ],
          }),
        } as Response;
      }
      throw new Error(`unexpected search ${query} page ${page}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await createOneMapSource().fetchAmenities({ lat: 1.3567, lng: 103.8881 });
    expect(out.map((a) => a.kind).sort()).toEqual(["mrt", "school"]);
    expect(out.find((a) => a.kind === "mrt")?.name).toBe("KOVAN MRT STATION");
    expect(out.find((a) => a.kind === "school")?.name).toBe("XINMIN PRIMARY SCHOOL");
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls).toContainEqual(expect.stringContaining("searchVal=MRT%20STATION"));
    expect(urls).toContainEqual(expect.stringContaining("searchVal=PRIMARY%20SCHOOL"));
  });

  it("fetchAmenities paginates OneMap search until totalNumPages", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      const query = u.searchParams.get("searchVal");
      const page = Number(u.searchParams.get("pageNum"));
      return {
        ok: true,
        json: async () => ({
          found: query === "MRT STATION" ? 11 : 0,
          totalNumPages: query === "MRT STATION" ? 2 : 1,
          results:
            query === "MRT STATION" && page === 2
              ? [{ SEARCHVAL: "KOVAN MRT STATION", LATITUDE: "1.3601", LONGITUDE: "103.8852" }]
              : [],
        }),
      } as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await createOneMapSource().fetchAmenities({ lat: 1.3567, lng: 103.8881 });
    expect(out.filter((a) => a.kind === "mrt")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("MRT%20STATION"))).toHaveLength(
      2
    );
  });
});
