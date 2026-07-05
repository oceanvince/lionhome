import { describe, it, expect } from "vitest";
import { SEED_TAX_RATES } from "@/lib/tax";
import { computeFit, type FitCalcInput } from "@/lib/condo/fit";

// A comfortable dual-income citizen first-time buyer.
const CALC: FitCalcInput = {
  residency: "citizen",
  existingProperties: 0,
  annualIncome: 180_000,
  age: 35,
  availableCash: 600_000,
  availableCpf: 200_000,
  loanTenureYears: 30,
  existingMonthlyDebt: 0,
  displayRate: 0.0165,
};

describe("computeFit", () => {
  it("returns null when the project has no cached PSF", () => {
    expect(computeFit({ psfMin: null, calc: CALC, taxRates: SEED_TAX_RATES })).toBeNull();
  });

  it("computes price-from, comfort range and ABSD for a citizen first home", () => {
    const fit = computeFit({ psfMin: 1780, calc: CALC, taxRates: SEED_TAX_RATES })!;
    expect(fit.projectPriceFrom).toBe(1_780_000); // 1780 × 1000 sqft
    expect(fit.comfortRange.high).toBeGreaterThan(fit.comfortRange.low);
    expect(["in_budget", "slightly_over", "over"]).toContain(fit.status);
    expect(fit.absdRatePct).toBe(0); // citizen first property → 0% ABSD
    expect(fit.absd).toBe(0);
  });

  it("charges ABSD for a PR second property", () => {
    const fit = computeFit({
      psfMin: 1780,
      calc: { ...CALC, residency: "pr", existingProperties: 1 },
      taxRates: SEED_TAX_RATES,
    })!;
    expect(fit.absdRatePct).toBeGreaterThan(0);
    expect(fit.absd).toBeGreaterThan(0);
  });

  it("flags an out-of-budget project as over", () => {
    const fit = computeFit({
      psfMin: 9000, // ~S$9M entry — well beyond this buyer
      calc: CALC,
      taxRates: SEED_TAX_RATES,
    })!;
    expect(fit.status).toBe("over");
  });
});
