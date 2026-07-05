import { describe, it, expect, vi } from "vitest";
import type { CondoProject } from "@/lib/condo/types";
import type { ProjectScore } from "@/lib/project-scoring";

// Five projects in NAME order (as SQL returns them for the profit path), with
// profit scores deliberately NOT matching name order, so "alphabetical top-N
// re-sorted" and "true profit top-N" give different answers.
const { PROJECTS, PROFIT } = vi.hoisted(() => {
  const mk = (id: string, name: string, psfMin: number, topYear: number): CondoProject => ({
    id,
    slug: name.toLowerCase(),
    name,
    district: "D19",
    tenure: null,
    topYear,
    totalUnits: null,
    developer: null,
    lat: null,
    lng: null,
    psfMin,
    psfMax: psfMin + 100,
    psfPeriodEnd: null,
    status: "active",
  });
  return {
    PROJECTS: [
      mk("a", "Alpha", 1000, 2018),
      mk("b", "Bravo", 1400, 2024),
      mk("c", "Charlie", 1200, 2020),
      mk("d", "Delta", 1100, 2022),
      mk("e", "Echo", 1300, 2019),
    ],
    // profit top-3 = Bravo(9), Delta(8), Echo(7); name top-3 = Alpha,Bravo,Charlie
    PROFIT: { a: 1, b: 9, c: 2, d: 8, e: 7 } as Record<string, number>,
  };
});

// Mock the repo so listCards is exercised against in-memory data. The mock
// emulates SQL: it honours the sort + limit it is given.
vi.mock("@/lib/condo/repo", () => ({
  listActiveProjects: vi.fn(
    async (_db: unknown, opts: { sort?: string; limit?: number; district?: string }) => {
      const rows = [...PROJECTS]; // name-sorted baseline
      if (opts.sort === "psf_asc")
        rows.sort((x, y) => (x.psfMin ?? Infinity) - (y.psfMin ?? Infinity));
      else if (opts.sort === "top_desc")
        rows.sort((x, y) => (y.topYear ?? -Infinity) - (x.topYear ?? -Infinity));
      return rows.slice(0, opts.limit ?? 30);
    }
  ),
  getScoresForProjects: vi.fn(async (_db: unknown, ids: string[]) => {
    const m = new Map<string, ProjectScore[]>();
    for (const id of ids) {
      m.set(id, [{ dimension: "profit", score: PROFIT[id], band: "good" } as ProjectScore]);
    }
    return m;
  }),
}));

const { listCards, computeFallback, COLD_START_THRESHOLD } = await import("@/lib/condo/search");
const repo = await import("@/lib/condo/repo");
const db = {} as never;

describe("listCards — profit sort selects the true top-N (regression: O06)", () => {
  it("limits AFTER sorting by profit, not before", async () => {
    const cards = await listCards(db, { sort: "profit", limit: 3 });
    // The bug returned [Bravo, Charlie, Alpha] (alphabetical top-3 re-sorted).
    expect(cards.map((c) => c.slug)).toEqual(["bravo", "delta", "echo"]);
    expect(cards.map((c) => c.profitScore)).toEqual([9, 8, 7]);
  });

  it("orders the full set by profit descending when not limited", async () => {
    const cards = await listCards(db, { sort: "profit" });
    expect(cards.map((c) => c.profitScore)).toEqual([9, 8, 7, 2, 1]);
  });

  it("defaults to profit sort", async () => {
    const cards = await listCards(db, { limit: 2 });
    expect(cards.map((c) => c.slug)).toEqual(["bravo", "delta"]);
  });

  it("delegates ordering+limit to SQL for psf_asc (no in-memory re-sort/slice)", async () => {
    const cards = await listCards(db, { sort: "psf_asc", limit: 3 });
    // psf-ascending top-3 by psfMin: Alpha(1000), Delta(1100), Charlie(1200)
    expect(cards.map((c) => c.slug)).toEqual(["alpha", "delta", "charlie"]);
  });

  it("O03 top_desc delegates ordering to SQL (by topYear, no JS re-sort)", async () => {
    const cards = await listCards(db, { sort: "top_desc" });
    // topYear desc: Bravo(2024) Delta(2022) Charlie(2020) Echo(2019) Alpha(2018)
    expect(cards.map((c) => c.slug)).toEqual(["bravo", "delta", "charlie", "echo", "alpha"]);
  });

  it("O05 equal profit scores keep a deterministic (name-order) sequence", async () => {
    vi.mocked(repo.listActiveProjects).mockResolvedValueOnce([PROJECTS[0]!, PROJECTS[2]!]); // Alpha, Charlie
    vi.mocked(repo.getScoresForProjects).mockResolvedValueOnce(
      new Map([
        ["a", [{ dimension: "profit", score: 5, band: "good" } as ProjectScore]],
        ["c", [{ dimension: "profit", score: 5, band: "good" } as ProjectScore]],
      ])
    );
    const cards = await listCards(db, { sort: "profit" });
    expect(cards.map((c) => c.slug)).toEqual(["alpha", "charlie"]); // stable sort preserves input order
  });
});

describe("listCards — card assembly (L group)", () => {
  it("L02 each card carries the four preview essentials", async () => {
    const card = (await listCards(db, { sort: "profit", limit: 1 }))[0]!;
    expect(card).toMatchObject({
      slug: "bravo",
      profitScore: 9, // 盈利分（主）
      psfMin: 1400, // PSF 区间
      psfMax: 1500,
      topYear: 2024, // 关键标签
    });
    expect(card.verdict.tier).toBe("green"); // 结论徽章
    expect(card).toHaveProperty("tenure"); // present even when null
  });

  it("L08 reads the DB exactly twice (projects + batched scores) — no N+1", async () => {
    vi.mocked(repo.listActiveProjects).mockClear();
    vi.mocked(repo.getScoresForProjects).mockClear();
    await listCards(db, { sort: "profit" });
    expect(repo.listActiveProjects).toHaveBeenCalledTimes(1);
    expect(repo.getScoresForProjects).toHaveBeenCalledTimes(1); // one batched `in (...)`, not per-project
  });

  it("L09 a project with no scores → profitScore null, verdict orange, no throw", async () => {
    vi.mocked(repo.listActiveProjects).mockResolvedValueOnce([PROJECTS[0]!]);
    vi.mocked(repo.getScoresForProjects).mockResolvedValueOnce(new Map()); // no scores
    const card = (await listCards(db, { sort: "profit" }))[0]!;
    expect(card.profitScore).toBeNull();
    expect(card.profitConfidence).toBeNull();
    expect(card.verdict.tier).toBe("orange"); // mean=null → 谨慎比较
  });
});

describe("computeFallback — never present an empty list as normal (B group)", () => {
  const big = COLD_START_THRESHOLD + 20; // catalogue populated

  it("B01 cold_start when active count is below threshold (regardless of filter)", () => {
    expect(computeFallback({ activeCount: 5, resultCount: 10, filtered: false })).toBe(
      "cold_start"
    );
    expect(computeFallback({ activeCount: 5, resultCount: 0, filtered: true })).toBe("cold_start");
  });

  it("B02 zero_result when populated but a filtered query matched nothing", () => {
    expect(computeFallback({ activeCount: big, resultCount: 0, filtered: true })).toBe(
      "zero_result"
    );
  });

  it("B03 none on a normal populated hit", () => {
    expect(computeFallback({ activeCount: big, resultCount: 3, filtered: true })).toBe("none");
  });

  it("B03b an empty UNfiltered list is not a zero_result", () => {
    expect(computeFallback({ activeCount: big, resultCount: 0, filtered: false })).toBe("none");
  });

  it("B06 threshold is the boundary: < cold, >= populated", () => {
    expect(
      computeFallback({ activeCount: COLD_START_THRESHOLD - 1, resultCount: 0, filtered: true })
    ).toBe("cold_start");
    expect(
      computeFallback({ activeCount: COLD_START_THRESHOLD, resultCount: 0, filtered: true })
    ).toBe("zero_result");
  });
});
