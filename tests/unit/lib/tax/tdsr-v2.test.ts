import { describe, it, expect } from "vitest";
import {
  solveByMonthlyRatio,
  computeTiers,
  COMFORT_RATIO,
  BALANCED_RATIO,
  SEED_TAX_RATES,
} from "@/lib/tax";
import type { SolveParams } from "@/lib/tax";

// Build SolveParams from a compact profile, using seed tax rates.
function profile(p: {
  annualIncome: number;
  availableCash: number;
  availableCpf?: number;
  age?: number;
  tenureYears?: number;
  propertyCount?: number;
  residency?: SolveParams["residency"];
  existingMonthlyDebt?: number;
}): SolveParams {
  return {
    annualIncome: p.annualIncome,
    existingMonthlyDebt: p.existingMonthlyDebt ?? 0,
    availableCash: p.availableCash,
    availableCpf: p.availableCpf ?? 0,
    age: p.age ?? 35,
    tenureYears: p.tenureYears ?? 30,
    propertyCount: p.propertyCount ?? 1,
    residency: p.residency ?? "citizen",
    bsdSlabs: SEED_TAX_RATES.bsd_slabs,
    absdMatrix: SEED_TAX_RATES.absd_matrix,
    ltvRules: SEED_TAX_RATES.ltv_rules,
    tdsr: SEED_TAX_RATES.tdsr,
    displayRate: 0.0165,
  };
}

describe("solveByMonthlyRatio", () => {
  it("a lower ratio yields a lower max price (30% < 35% < 55%)", () => {
    const params = profile({
      annualIncome: 300_000,
      availableCash: 600_000,
      availableCpf: 350_000,
    });
    const comfort = solveByMonthlyRatio(0.3, params).max_price;
    const balanced = solveByMonthlyRatio(0.35, params).max_price;
    const aggressive = solveByMonthlyRatio(0.55, params).max_price;
    expect(comfort).toBeGreaterThan(0);
    expect(comfort).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(aggressive);
  });

  it("matches solveMaxPurchasePrice when ratio = tdsr.cap", () => {
    const params = profile({
      annualIncome: 210_000,
      availableCash: 400_000,
      availableCpf: 250_000,
    });
    const viaRatio = solveByMonthlyRatio(params.tdsr.cap, params).max_price;
    const balanced = solveByMonthlyRatio(BALANCED_RATIO, params).max_price;
    expect(viaRatio).toBeGreaterThan(balanced);
  });

  it("returns TDSR_EXCEEDED when income cannot support any loan", () => {
    const params = profile({
      annualIncome: 6_000,
      availableCash: 1_000_000,
      existingMonthlyDebt: 5_000,
    });
    const out = solveByMonthlyRatio(COMFORT_RATIO, params);
    expect(out.max_price).toBe(0);
    expect(out.infeasible_reason).toBe("TDSR_EXCEEDED");
  });

  it("returns INSUFFICIENT_CASH when cash cannot cover even minimal upfront", () => {
    const params = profile({ annualIncome: 300_000, availableCash: 0, availableCpf: 0 });
    const out = solveByMonthlyRatio(COMFORT_RATIO, params);
    expect(out.max_price).toBe(0);
    expect(out.infeasible_reason).toBe("INSUFFICIENT_CASH");
  });
});

describe("computeTiers", () => {
  it("produces three contiguous, ascending bands for a healthy profile", () => {
    const params = profile({
      annualIncome: 300_000,
      availableCash: 700_000,
      availableCpf: 350_000,
    });
    const t = computeTiers(params);
    expect(t.comfortable.price_high).toBeGreaterThan(0);
    // contiguous: balanced.low == comfortable.high, aggressive.low == balanced.high
    expect(t.balanced.price_low).toBe(t.comfortable.price_high);
    expect(t.aggressive.price_low).toBe(t.balanced.price_high);
    // ascending uppers
    expect(t.comfortable.price_high).toBeLessThanOrEqual(t.balanced.price_high);
    expect(t.balanced.price_high).toBeLessThanOrEqual(t.aggressive.price_high);
    expect(t.degenerate).toBe(false);
  });

  it("midpoint output uses the tier ratio (comfortable monthly < aggressive monthly)", () => {
    const params = profile({
      annualIncome: 300_000,
      availableCash: 700_000,
      availableCpf: 350_000,
    });
    const t = computeTiers(params);
    // higher band → higher price → higher monthly payment
    expect(t.comfortable.output.monthly_payment.stress).toBeLessThan(
      t.aggressive.output.monthly_payment.stress
    );
  });

  it("flags degenerate when cash caps all three tiers to the same price", () => {
    // High income (TDSR never binds) but tiny cash → LTV/cash binds equally for every ratio.
    const params = profile({ annualIncome: 2_000_000, availableCash: 200_000, availableCpf: 0 });
    const t = computeTiers(params);
    expect(t.degenerate).toBe(true);
    expect(t.comfortable.price_high).toBe(t.aggressive.price_high);
  });

  it("PR · 35yo · ~17.5K/mo · first home lands balanced band in a sane range", () => {
    const params = profile({
      annualIncome: 210_000,
      availableCash: 350_000,
      availableCpf: 200_000,
      residency: "pr",
      propertyCount: 1,
      age: 35,
    });
    const t = computeTiers(params);
    // SPEC §11 acceptance: balanced ~1.3M–1.6M
    expect(t.balanced.price_high).toBeGreaterThan(1_000_000);
    expect(t.balanced.price_high).toBeLessThan(2_200_000);
  });
});
