import { describe, it, expect } from "vitest";
import { calculateAbsd, getAbsdRate } from "@/lib/tax/absd";
import type { AbsdMatrixEntry } from "@/lib/tax/types";

const matrix: AbsdMatrixEntry[] = [
  { residency: "citizen", property_count: 1, rate: 0.0 },
  { residency: "citizen", property_count: 2, rate: 0.2 },
  { residency: "citizen", property_count: 3, rate: 0.3 },
  { residency: "pr", property_count: 1, rate: 0.05 },
  { residency: "pr", property_count: 2, rate: 0.3 },
  { residency: "pr", property_count: 3, rate: 0.35 },
  { residency: "foreigner", property_count: 1, rate: 0.6 },
  { residency: "foreigner", property_count: 2, rate: 0.6 },
  { residency: "foreigner", property_count: 3, rate: 0.6 },
];

describe("getAbsdRate", () => {
  it("returns the configured rate for a citizen second property", () => {
    expect(getAbsdRate("citizen", 2, matrix)).toBe(0.2);
  });

  it("collapses 4+ properties to the 3-tier rate", () => {
    expect(getAbsdRate("pr", 5, matrix)).toBe(0.35);
  });

  it("throws if the matrix has no entry for the combination", () => {
    expect(() => getAbsdRate("company", 1, matrix)).toThrow();
  });
});

describe("calculateAbsd", () => {
  it("returns 0 when price is non-positive", () => {
    expect(calculateAbsd(0, "pr", 1, matrix)).toBe(0);
  });

  it("computes 5% ABSD for a PR first property at SGD 2M", () => {
    expect(calculateAbsd(2_000_000, "pr", 1, matrix)).toBe(100_000);
  });

  it("computes 60% ABSD for a foreigner first property at SGD 2M", () => {
    expect(calculateAbsd(2_000_000, "foreigner", 1, matrix)).toBe(1_200_000);
  });
});
