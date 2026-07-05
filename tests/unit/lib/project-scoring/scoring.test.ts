import { describe, it, expect } from "vitest";
import {
  scoreProject,
  computeProfitScore,
  computeLocationScore,
  buildVerdict,
  isSimilarProject,
  scoreToBand,
  SCORE_VERSION,
  type ScoringInput,
  type TxnLite,
  type AmenityLite,
  type ProjectScore,
} from "@/lib/project-scoring";

const SNAP = "2026-06-15";

function txn(date: string, psf: number, bed = "3", saleType = 2): TxnLite {
  const areaSqft = 1000;
  return { txnDate: date, psf, areaSqft, price: psf * areaSqft, bedroomType: bed, saleType };
}

function input(over: Partial<ScoringInput>): ScoringInput {
  return {
    projectMeta: { id: "p1", district: "D19", topYear: 2018 },
    transactions: [],
    amenities: [],
    regionalAnnualAppreciation: 0.028,
    snapshotDate: SNAP,
    ...over,
  };
}

// A rising 3-bed resale history, with ≥3 txns in the last 12 months.
const RISING_RESALE: TxnLite[] = [
  txn("2024-08-01", 1700),
  txn("2024-11-01", 1720),
  txn("2025-02-01", 1760),
  txn("2025-05-01", 1800),
  txn("2025-08-01", 1850),
  txn("2025-11-01", 1900),
  txn("2026-02-01", 1950),
  txn("2026-05-01", 1980),
];

describe("scoreToBand — single source of truth", () => {
  it("maps thresholds and null", () => {
    expect(scoreToBand(null)).toBe("insufficient");
    expect(scoreToBand(2.9)).toBe("poor");
    expect(scoreToBand(3)).toBe("fair");
    expect(scoreToBand(5)).toBe("good");
    expect(scoreToBand(7)).toBe("excellent");
  });
});

describe("computeProfitScore", () => {
  it("scores a rising history above baseline with high confidence", () => {
    const s = computeProfitScore(input({ transactions: RISING_RESALE }));
    expect(s.dimension).toBe("profit");
    expect(s.score).not.toBeNull();
    expect(s.score! > 5).toBe(true); // beats the 0.028 baseline
    expect(s.confidence).toBe("high"); // ≥3 resale in 12m
    expect(String(s.components.includedBedroomTypes)).toContain("3");
    expect(s.scoreVersion).toBe(SCORE_VERSION);
  });

  it("returns insufficient (null) when there is no resale history", () => {
    const s = computeProfitScore(input({ transactions: [] }));
    expect(s.score).toBeNull();
    expect(s.band).toBe("insufficient");
    expect(s.confidence).toBe("low");
  });

  it("falls back to similar projects and flags estimated_similar", () => {
    const own = [txn("2026-01-01", 1900)]; // only 1 own resale (< MIN_GROUP_SAMPLE)
    const s = computeProfitScore(
      input({
        transactions: own,
        similarTransactions: RISING_RESALE,
        similarProjectNames: ["Comp A", "Comp B"],
      })
    );
    expect(s.confidence).toBe("estimated_similar");
    expect(s.basis.similarProjects).toEqual(["Comp A", "Comp B"]);
    expect(s.score).not.toBeNull();
  });

  it("is deterministic for the same input + snapshot", () => {
    const a = computeProfitScore(input({ transactions: RISING_RESALE }));
    const b = computeProfitScore(input({ transactions: RISING_RESALE }));
    expect(a).toEqual(b);
  });

  it("flags a fresh project as new_project regime", () => {
    const s = computeProfitScore(
      input({
        transactions: RISING_RESALE,
        projectMeta: { id: "p1", district: "D19", topYear: 2026 },
      })
    );
    expect(s.regime).toBe("new_project");
  });
});

describe("computeLocationScore", () => {
  const amenities: AmenityLite[] = [
    { kind: "mrt", name: "Kovan MRT", distanceM: 600, walkMinutes: 8 },
    { kind: "school", name: "Xinmin Pri", distanceM: 600, walkMinutes: null },
    { kind: "school", name: "PLMGS", distanceM: 900, walkMinutes: null },
    { kind: "mall", name: "Heartland Mall", distanceM: 700, walkMinutes: 9 },
    { kind: "park", name: "Park", distanceM: 500, walkMinutes: 6 },
  ];

  it("scores transit + schools + density", () => {
    const s = computeLocationScore(input({ amenities }));
    expect(s.score).not.toBeNull();
    expect(s.confidence).toBe("high");
    expect(s.components.nearestMrtWalkMin).toBe(8);
    expect(s.components.schoolsWithin1km).toBe(2);
  });

  it("returns insufficient with no amenity data", () => {
    const s = computeLocationScore(input({ amenities: [] }));
    expect(s.score).toBeNull();
    expect(s.band).toBe("insufficient");
  });

  it("downgrades confidence when transit data is missing", () => {
    const noMrt = amenities.filter((a) => a.kind !== "mrt");
    const s = computeLocationScore(input({ amenities: noMrt }));
    expect(s.confidence).toBe("low");
  });
});

describe("buildVerdict — template, no fabricated numbers", () => {
  function dim(
    dimension: ProjectScore["dimension"],
    score: number | null,
    extra = {}
  ): ProjectScore {
    return {
      dimension,
      score,
      band: scoreToBand(score),
      confidence: "high",
      components: extra,
      basis: {},
      snapshotDate: SNAP,
      scoreVersion: SCORE_VERSION,
    };
  }

  it("green when profit+location mean is strong", () => {
    const v = buildVerdict([dim("profit", 6.8), dim("location", 7.8, { nearestMrtWalkMin: 8 })]);
    expect(v.tier).toBe("green");
    expect(v.label).toBe("值得入候选");
    expect(v.sentence).toContain("最近地铁约 8 分钟");
    expect(v.sentence).toContain("退出与租赁");
  });

  it("orange when data is insufficient", () => {
    const v = buildVerdict([dim("profit", null), dim("location", null)]);
    expect(v.tier).toBe("orange");
    expect(v.label).toBe("谨慎比较");
  });
});

describe("isSimilarProject", () => {
  const target = { district: "D19", psfMid: 1880, topYear: 2023 };
  it("accepts same district, close PSF, near TOP age", () => {
    expect(isSimilarProject(target, { district: "D19", psfMid: 1900, topYear: 2022 })).toBe(true);
  });
  it("rejects a different district", () => {
    expect(isSimilarProject(target, { district: "D10", psfMid: 1900, topYear: 2022 })).toBe(false);
  });
  it("rejects a far-off PSF band", () => {
    expect(isSimilarProject(target, { district: "D19", psfMid: 2600, topYear: 2022 })).toBe(false);
  });
});

describe("scoreProject — orchestration", () => {
  it("returns all four dimensions with exit/rental as coming_soon", () => {
    const scores = scoreProject(input({ transactions: RISING_RESALE }));
    expect(scores.map((s) => s.dimension)).toEqual(["profit", "location", "exit", "rental"]);
    const exit = scores.find((s) => s.dimension === "exit")!;
    expect(exit.score).toBeNull();
    expect(exit.components.status).toBe("coming_soon");
  });
});
