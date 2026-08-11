import { describe, it, expect, vi } from "vitest";
import type { TxnLite, AmenityLite } from "@/lib/project-scoring";
import { shouldPromote, ingestProject, type IngestRepo } from "@/lib/condo/ingest/pipeline";
import { createFixtureSources } from "@/lib/condo/ingest/sources";
import type { DbClient } from "@/lib/condo/repo";

const DATES = ["2025-01-01", "2025-04-01", "2025-08-01", "2026-01-01", "2026-05-01"];
const txns: TxnLite[] = DATES.map((txnDate, i) => {
  const psf = 1700 + i * 50;
  return { txnDate, psf, areaSqft: 1000, price: psf * 1000, bedroomType: "3", saleType: 2 };
});
const amenities: AmenityLite[] = [
  { kind: "mrt", name: "Kovan MRT", distanceM: 600, walkMinutes: 8 },
  { kind: "school", name: "Xinmin", distanceM: 600, walkMinutes: null },
];

function mockRepo(): IngestRepo & { calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  const bump = (k: string) => (calls[k] = (calls[k] ?? 0) + 1);
  return {
    calls,
    upsertTransactions: vi.fn(async () => void bump("upsertTransactions")),
    refreshPsfRange: vi.fn(async () => void bump("refreshPsfRange")),
    upsertAmenities: vi.fn(async () => void bump("upsertAmenities")),
    updateProjectGeo: vi.fn(async () => void bump("updateProjectGeo")),
    upsertScores: vi.fn(async () => void bump("upsertScores")),
    setProjectStatus: vi.fn(async () => void bump("setProjectStatus")),
  };
}

describe("shouldPromote", () => {
  it("promotes when profit or location has a real score", () => {
    expect(
      shouldPromote([
        { dimension: "profit", score: 6.5 } as never,
        { dimension: "location", score: null } as never,
      ])
    ).toBe(true);
  });
  it("does not promote when both are null", () => {
    expect(
      shouldPromote([
        { dimension: "profit", score: null } as never,
        { dimension: "location", score: null } as never,
      ])
    ).toBe(false);
  });
});

describe("ingestProject (DI repo, no DB)", () => {
  const sources = createFixtureSources({
    "The Gazania": { geocode: { lat: 1.35, lng: 103.88 }, transactions: txns, amenities },
  });
  const db = {} as DbClient;
  const project = { id: "p1", name: "The Gazania", district: "D19", topYear: 2018 };

  it("runs the full chain, scores, and promotes a data-ready project", async () => {
    const repo = mockRepo();
    const res = await ingestProject(db, project, sources, { snapshotDate: "2026-06-15", repo });

    expect(res.txnCount).toBe(txns.length);
    expect(res.promoted).toBe(true);
    expect(repo.calls.upsertTransactions).toBe(1);
    expect(repo.calls.upsertScores).toBe(1);
    expect(repo.calls.updateProjectGeo).toBe(1); // fixture geocoded
    expect(repo.calls.setProjectStatus).toBe(1); // promoted → active

    const profit = res.scores.find((s) => s.dimension === "profit")!;
    expect(profit.score).not.toBeNull();
  });

  it("leaves an unknown project as stub (no data → no promote)", async () => {
    const repo = mockRepo();
    const res = await ingestProject(
      db,
      { id: "p2", name: "Unknown Condo", district: "D19", topYear: 2018 },
      sources,
      { snapshotDate: "2026-06-15", repo }
    );
    expect(res.promoted).toBe(false);
    expect(repo.calls.setProjectStatus ?? 0).toBe(0); // never promoted
  });
});

/**
 * A transient upstream failure must never be written as "this project has no
 * data". upsertAmenities replaces the whole set and upsertScores overwrites on
 * a fixed conflict key, so a single URA or OneMap error used to erase good
 * amenities and rewrite a real score as 数据不足.
 */
describe("ingestProject — an upstream failure must not overwrite good data", () => {
  const db = {} as DbClient;
  const project = { id: "p1", name: "The Gazania", district: "D19", topYear: 2018 };
  const healthy = createFixtureSources({
    "The Gazania": { geocode: { lat: 1.35, lng: 103.88 }, transactions: txns, amenities },
  });

  it("skips the transaction write and the score when URA throws", async () => {
    const repo = mockRepo();
    const sources = {
      ...healthy,
      ura: {
        fetchTransactions: vi.fn(async () => {
          throw new Error("URA batch 1 HTTP 500");
        }),
      },
    };

    const res = await ingestProject(db, project, sources, { snapshotDate: "2026-06-15", repo });

    expect(repo.calls.upsertTransactions ?? 0).toBe(0);
    expect(repo.calls.refreshPsfRange ?? 0).toBe(0);
    expect(repo.calls.upsertScores ?? 0).toBe(0);
    expect(repo.calls.setProjectStatus ?? 0).toBe(0);
    expect(res.skipped).toContain("transactions");
    expect(res.promoted).toBe(false);
  });

  it("skips the amenity write and the score when OneMap throws", async () => {
    const repo = mockRepo();
    const sources = {
      ...healthy,
      oneMap: {
        geocode: async () => ({ lat: 1.35, lng: 103.88 }),
        fetchAmenities: vi.fn(async () => {
          throw new Error("OneMap 503");
        }),
      },
    };

    const res = await ingestProject(db, project, sources, { snapshotDate: "2026-06-15", repo });

    expect(repo.calls.upsertAmenities ?? 0).toBe(0);
    expect(repo.calls.upsertScores ?? 0).toBe(0);
    expect(res.skipped).toContain("amenities");
  });

  it("treats a failed geocode as a failed amenity fetch, not as zero amenities", async () => {
    const repo = mockRepo();
    const sources = {
      ...healthy,
      oneMap: {
        geocode: async () => null,
        fetchAmenities: vi.fn(async () => amenities),
      },
    };

    const res = await ingestProject(db, project, sources, { snapshotDate: "2026-06-15", repo });

    expect(repo.calls.upsertAmenities ?? 0).toBe(0);
    expect(repo.calls.updateProjectGeo ?? 0).toBe(0);
    expect(res.skipped).toContain("amenities");
  });

  it("still writes a genuinely empty result, which is data and not a failure", async () => {
    const repo = mockRepo();
    const sources = {
      ...healthy,
      oneMap: {
        geocode: async () => ({ lat: 1.35, lng: 103.88 }),
        fetchAmenities: async () => [],
      },
    };

    const res = await ingestProject(db, project, sources, { snapshotDate: "2026-06-15", repo });

    expect(repo.calls.upsertAmenities).toBe(1);
    expect(repo.calls.upsertScores).toBe(1);
    expect(res.skipped).toEqual([]);
  });
});
