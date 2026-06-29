import { describe, it, expect } from "vitest";
import { computeViability, MIN_VIABLE_PRICE, SEED_TAX_RATES } from "@/lib/tax";
import type { SolveParams } from "@/lib/tax";

function profile(p: {
  age?: number;
  tenureYears?: number;
  propertyCount?: number;
  residency?: SolveParams["residency"];
  existingMonthlyDebt?: number;
  annualIncome?: number;
}): SolveParams {
  return {
    annualIncome: p.annualIncome ?? 120_000,
    existingMonthlyDebt: p.existingMonthlyDebt ?? 0,
    availableCash: 0,
    availableCpf: 0,
    age: p.age ?? 35,
    tenureYears: p.tenureYears ?? 30,
    propertyCount: p.propertyCount ?? 1, // buying first home = count 1
    residency: p.residency ?? "citizen",
    bsdSlabs: SEED_TAX_RATES.bsd_slabs,
    absdMatrix: SEED_TAX_RATES.absd_matrix,
    ltvRules: SEED_TAX_RATES.ltv_rules,
    tdsr: SEED_TAX_RATES.tdsr,
    displayRate: 0.0165,
  };
}

describe("computeViability", () => {
  it("defaults to the configurable MIN_VIABLE_PRICE (S$300k)", () => {
    const v = computeViability(profile({}));
    expect(v.min_viable_price).toBe(MIN_VIABLE_PRICE);
    expect(v.min_viable_price).toBe(300_000);
  });

  // SC first home @ 300k: LTV 75% → down 75k. BSD(300k)=4,200, ABSD=0, legal=1,100.
  it("SC first home: min down payment = down + BSD + legal = S$80,300", () => {
    const v = computeViability(profile({ residency: "citizen", propertyCount: 1 }));
    expect(v.min_down_payment).toBe(80_300);
  });

  it("min income is independent of the buyer's actual income", () => {
    const a = computeViability(profile({ annualIncome: 36_000 })).min_monthly_income;
    const b = computeViability(profile({ annualIncome: 500_000 })).min_monthly_income;
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it("foreigner ABSD (60%) lifts the min down payment far above an SC's", () => {
    const sc = computeViability(profile({ residency: "citizen" })).min_down_payment;
    const foreigner = computeViability(profile({ residency: "foreigner" })).min_down_payment;
    // 60% of 300k = 180k of ABSD on top.
    expect(foreigner).toBeGreaterThan(sc + 170_000);
  });

  it("accepts a price override (configurability)", () => {
    const v = computeViability(profile({}), 500_000);
    expect(v.min_viable_price).toBe(500_000);
  });
});
