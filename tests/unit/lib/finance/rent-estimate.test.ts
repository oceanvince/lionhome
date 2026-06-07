import { describe, it, expect } from "vitest";
import { estimateMedianRent, regionalAppreciationLookup } from "@/lib/finance";

describe("estimateMedianRent", () => {
  it("applies the correct yield band per price tier", () => {
    expect(estimateMedianRent(800_000)).toBe(Math.round((800_000 * 0.032) / 12 / 100) * 100);
    expect(estimateMedianRent(1_500_000)).toBe(Math.round((1_500_000 * 0.028) / 12 / 100) * 100);
    expect(estimateMedianRent(3_000_000)).toBe(Math.round((3_000_000 * 0.024) / 12 / 100) * 100);
    expect(estimateMedianRent(8_000_000)).toBe(Math.round((8_000_000 * 0.02) / 12 / 100) * 100);
  });

  it("rounds to the nearest $100 and handles zero", () => {
    expect(estimateMedianRent(1_500_000) % 100).toBe(0);
    expect(estimateMedianRent(0)).toBe(0);
  });

  it("rent rises monotonically with price", () => {
    expect(estimateMedianRent(1_500_000)).toBeGreaterThan(estimateMedianRent(800_000));
    expect(estimateMedianRent(3_000_000)).toBeGreaterThan(estimateMedianRent(1_500_000));
  });
});

describe("regionalAppreciationLookup", () => {
  it("returns the whole-city reference for MVP", () => {
    const ref = regionalAppreciationLookup();
    expect(ref.decade).toBeCloseTo(0.028);
    expect(ref.five_year).toBeCloseTo(0.018);
  });
});
