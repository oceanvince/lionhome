import { describe, it, expect } from "vitest";
import { computeMarketFloor, PRIVATE_FLOOR, SEED_TAX_RATES } from "@/lib/tax";
import type { SolveParams } from "@/lib/tax";

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
    propertyCount: p.propertyCount ?? 1, // buying first home = count 1
    residency: p.residency ?? "citizen",
    bsdSlabs: SEED_TAX_RATES.bsd_slabs,
    absdMatrix: SEED_TAX_RATES.absd_matrix,
    ltvRules: SEED_TAX_RATES.ltv_rules,
    tdsr: SEED_TAX_RATES.tdsr,
    displayRate: 0.0165,
  };
}

describe("computeMarketFloor", () => {
  it("default floor price is the configurable PRIVATE_FLOOR constant", () => {
    const f = computeMarketFloor(profile({ annualIncome: 120_000, availableCash: 10_000 }));
    expect(f.floor_price).toBe(PRIVATE_FLOOR.price);
    expect(f.floor_price).toBe(600_000);
  });

  it("accepts a floor-price override (configurability)", () => {
    const f = computeMarketFloor(
      profile({ annualIncome: 120_000, availableCash: 10_000 }),
      800_000
    );
    expect(f.floor_price).toBe(800_000);
  });

  // SC first home @ 600k: LTV 75% → loan 450k, down 150k. CPF 10k covers part of
  // the non-5% portion → cash down 140k. BSD(600k)=12,600, ABSD=0, legal=1,700.
  it("hard cash = down-payment cash + BSD + ABSD + legal fees", () => {
    const f = computeMarketFloor(
      profile({ annualIncome: 120_000, availableCash: 10_000, availableCpf: 10_000 })
    );
    expect(f.ltv_cap).toBe(0.75);
    expect(f.loan_amount).toBe(450_000);
    expect(f.down_payment_cash).toBe(140_000);
    expect(f.bsd).toBe(12_600);
    expect(f.absd).toBe(0);
    expect(f.min_cash_transaction).toBe(154_300);
  });

  it("emergency fund is 6.6 months of income, kept separate from the hard cash", () => {
    const f = computeMarketFloor(profile({ annualIncome: 120_000, availableCash: 10_000 }));
    expect(f.emergency_fund).toBe(66_000); // 120k × 0.55
  });

  it("the two gates are independent: low cash + ample income → cash-bound only", () => {
    const f = computeMarketFloor(
      profile({ annualIncome: 120_000, availableCash: 10_000, availableCpf: 10_000 })
    );
    expect(f.cash_ok).toBe(false);
    expect(f.cash_gap).toBe(144_300); // 154,300 − 10,000
    expect(f.income_ok).toBe(true); // 10k/mo clears the floor loan
    expect(f.income_gap).toBeLessThanOrEqual(0);
  });

  it("low income flips the binding gate to income", () => {
    const f = computeMarketFloor(profile({ annualIncome: 36_000, availableCash: 500_000 }));
    expect(f.cash_ok).toBe(true);
    expect(f.income_ok).toBe(false);
    expect(f.income_gap).toBeGreaterThan(0);
  });

  it("every output is finite", () => {
    const f = computeMarketFloor(profile({ annualIncome: 0.000001, availableCash: 0 }));
    for (const v of Object.values(f)) {
      if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
    }
  });
});
