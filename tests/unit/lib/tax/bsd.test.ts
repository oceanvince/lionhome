import { describe, it, expect } from "vitest";
import { calculateBsd } from "@/lib/tax/bsd";
import type { BsdSlab } from "@/lib/tax/types";

const slabs: BsdSlab[] = [
  { threshold_sgd: 0, rate: 0.01 },
  { threshold_sgd: 180_000, rate: 0.02 },
  { threshold_sgd: 360_000, rate: 0.03 },
  { threshold_sgd: 1_000_000, rate: 0.04 },
  { threshold_sgd: 1_500_000, rate: 0.05 },
  { threshold_sgd: 3_000_000, rate: 0.06 },
];

describe("calculateBsd", () => {
  it("returns 0 for non-positive prices", () => {
    expect(calculateBsd(0, slabs)).toBe(0);
    expect(calculateBsd(-100, slabs)).toBe(0);
  });

  it("computes a known IRAS-style example for SGD 1,000,000", () => {
    // 180k * 1% + 180k * 2% + 640k * 3% = 1800 + 3600 + 19200 = 24,600
    expect(calculateBsd(1_000_000, slabs)).toBe(24_600);
  });

  it("computes a known example for SGD 2,000,000", () => {
    // 24,600 + 500k * 4% + 500k * 5% = 24600 + 20000 + 25000 = 69,600
    expect(calculateBsd(2_000_000, slabs)).toBe(69_600);
  });

  it("applies the top-tier rate above SGD 3,000,000", () => {
    // BSD at 3M = 24,600 + 500k*4% + 1.5M*5% = 24,600 + 20,000 + 75,000 = 119,600
    // Plus 1M @ 6% = 60,000 → 179,600 at 4M
    expect(calculateBsd(4_000_000, slabs)).toBe(179_600);
  });
});
