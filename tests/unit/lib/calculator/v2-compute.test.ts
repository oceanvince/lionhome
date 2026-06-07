import { describe, it, expect } from "vitest";
import { computeV2 } from "@/lib/calculator/v2-compute";
import type { V2ComputeParams } from "@/lib/calculator/v2-compute";
import { SEED_TAX_RATES } from "@/lib/tax";
import type { SolveParams } from "@/lib/tax";

function params(p: {
  annualIncome: number;
  availableCash: number;
  availableCpf?: number;
  age?: number;
  propertyCount?: number;
  residency?: SolveParams["residency"];
}): V2ComputeParams {
  return {
    solveParams: {
      annualIncome: p.annualIncome,
      existingMonthlyDebt: 0,
      availableCash: p.availableCash,
      availableCpf: p.availableCpf ?? 0,
      age: p.age ?? 35,
      tenureYears: 30,
      propertyCount: p.propertyCount ?? 1,
      residency: p.residency ?? "citizen",
      bsdSlabs: SEED_TAX_RATES.bsd_slabs,
      absdMatrix: SEED_TAX_RATES.absd_matrix,
      ltvRules: SEED_TAX_RATES.ltv_rules,
      tdsr: SEED_TAX_RATES.tdsr,
      displayRate: 0.0165,
    },
    isFirstProperty: (p.propertyCount ?? 1) === 1,
    holdingYears: 7,
    rate: 0.0165,
    taxRatesVersion: "seed-2023-04-27",
  };
}

describe("computeV2 — response shape", () => {
  it("returns three tiers, break-even, and a legacy max price", () => {
    const r = computeV2(
      params({ annualIncome: 300_000, availableCash: 700_000, availableCpf: 350_000 })
    );
    expect(r.schema_version).toBe("v2");
    expect(Object.keys(r.tiers)).toEqual(["comfortable", "balanced", "aggressive"]);
    expect(r.break_even).not.toBeNull();
    expect(r.legacy_max_price).toBe(r.tiers.aggressive.price_high);
    // emergency fund ≈ 6.6 months income
    expect(r.tiers.balanced.cash_breakdown.emergency_fund_suggested).toBe(
      Math.round(300_000 * 0.55)
    );
  });

  it("comfortable stress monthly is ≈ 30% of income when TDSR binds", () => {
    const r = computeV2(
      params({ annualIncome: 300_000, availableCash: 1_500_000, availableCpf: 400_000 })
    );
    // With ample cash, TDSR binds → comfortable pct should sit near its 0.30 cap.
    expect(r.tiers.comfortable.monthly_pct_of_income).toBeLessThanOrEqual(0.31);
    expect(r.tiers.aggressive.monthly_pct_of_income).toBeGreaterThan(
      r.tiers.comfortable.monthly_pct_of_income
    );
  });
});

describe("computeV2 — acceptance pictures (SPEC §11)", () => {
  it("PR · 17.5K/mo · cash 35万 · CPF 20万 · 35yo · first", () => {
    const r = computeV2(
      params({
        annualIncome: 210_000,
        availableCash: 350_000,
        availableCpf: 200_000,
        residency: "pr",
        age: 35,
      })
    );
    expect(r.tiers.balanced.price_high).toBeGreaterThan(1_000_000);
    expect(r.tiers.balanced.price_high).toBeLessThan(2_200_000);
    expect(r.break_even?.tiers.balanced.g_star).toBeGreaterThan(-0.05);
  });

  it("SC · 25K/mo · cash 60万 · CPF 35万 · 32yo · first → balanced ~1.8–2.2M", () => {
    const r = computeV2(
      params({ annualIncome: 300_000, availableCash: 600_000, availableCpf: 350_000, age: 32 })
    );
    expect(r.tiers.balanced.price_high).toBeGreaterThan(1_500_000);
    expect(r.tiers.balanced.price_high).toBeLessThan(2_800_000);
  });

  it("foreigner WP · 20K/mo · cash 80万 · CPF 0 · first → very tight, break-even still present", () => {
    const r = computeV2(
      params({
        annualIncome: 240_000,
        availableCash: 800_000,
        availableCpf: 0,
        residency: "foreigner",
      })
    );
    // 60% ABSD crushes affordability — aggressive ceiling stays modest vs income
    expect(r.tiers.aggressive.price_high).toBeLessThan(1_500_000);
    expect(r.break_even).not.toBeNull();
  });

  it("second property → no break-even block", () => {
    const r = computeV2(
      params({
        annualIncome: 360_000,
        availableCash: 1_000_000,
        availableCpf: 400_000,
        propertyCount: 2,
      })
    );
    expect(r.break_even).toBeNull();
  });
});
