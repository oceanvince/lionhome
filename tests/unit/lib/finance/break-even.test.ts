import { describe, it, expect } from "vitest";
import { computeBreakEven, breakEvenFromCalcOutputs } from "@/lib/finance";
import type { BreakEvenInput } from "@/lib/finance";
import { computeTiers, SEED_TAX_RATES } from "@/lib/tax";
import type { SolveParams } from "@/lib/tax";

const baseInput: BreakEvenInput = {
  price: 1_500_000,
  loanAmount: 1_125_000, // 75% LTV
  upfrontCash: 200_000,
  monthlyRent: 3_500,
  holdingYears: 7,
  tenureYears: 30,
  rate: 0.0165,
};

describe("computeBreakEven", () => {
  it("returns g* within the search band for a typical profile", () => {
    const { g_star } = computeBreakEven(baseInput);
    expect(g_star).toBeGreaterThan(-0.1);
    expect(g_star).toBeLessThan(0.15);
  });

  it("higher rent makes buying break even at a lower appreciation", () => {
    const low = computeBreakEven({ ...baseInput, monthlyRent: 3_000 }).g_star;
    const high = computeBreakEven({ ...baseInput, monthlyRent: 5_500 }).g_star;
    expect(high).toBeLessThan(low);
  });

  it("a higher mortgage rate raises the break-even appreciation", () => {
    const cheap = computeBreakEven({ ...baseInput, rate: 0.015 }).g_star;
    const dear = computeBreakEven({ ...baseInput, rate: 0.04 }).g_star;
    expect(dear).toBeGreaterThan(cheap);
  });

  it("clamps 'below' when rent is so high that buying always wins", () => {
    const r = computeBreakEven({ ...baseInput, monthlyRent: 30_000 });
    expect(r.clamped).toBe("below");
    expect(r.g_star).toBe(-0.1);
    expect(r.monthly_saving).toBeLessThan(0); // owning is cheaper than this rent
  });

  it("negligible rent pushes the break-even appreciation far higher", () => {
    const typical = computeBreakEven(baseInput).g_star;
    const r = computeBreakEven({ ...baseInput, monthlyRent: 200 });
    expect(r.g_star).toBeGreaterThan(typical);
    expect(r.g_star).toBeLessThanOrEqual(0.15);
  });

  it("a longer hold needs higher appreciation (renter compounds at r_alt > g)", () => {
    const short = computeBreakEven({ ...baseInput, holdingYears: 5 }).g_star;
    const long = computeBreakEven({ ...baseInput, holdingYears: 15 }).g_star;
    expect(long).toBeGreaterThan(short);
  });
});

describe("breakEvenFromCalcOutputs", () => {
  it("maps a tier midpoint output into a sane break-even", () => {
    const params: SolveParams = {
      annualIncome: 300_000,
      existingMonthlyDebt: 0,
      availableCash: 700_000,
      availableCpf: 350_000,
      age: 35,
      tenureYears: 30,
      propertyCount: 1,
      residency: "citizen",
      bsdSlabs: SEED_TAX_RATES.bsd_slabs,
      absdMatrix: SEED_TAX_RATES.absd_matrix,
      ltvRules: SEED_TAX_RATES.ltv_rules,
      tdsr: SEED_TAX_RATES.tdsr,
      displayRate: 0.0165,
    };
    const tiers = computeTiers(params);
    const r = breakEvenFromCalcOutputs(tiers.balanced.output, {
      monthlyRent: 4_500,
      holdingYears: 7,
      tenureYears: 30,
      rate: 0.0165,
    });
    expect(r.g_star).toBeGreaterThan(-0.1);
    expect(r.g_star).toBeLessThan(0.15);
    expect(r.monthly_mortgage).toBeGreaterThan(0);
  });
});
