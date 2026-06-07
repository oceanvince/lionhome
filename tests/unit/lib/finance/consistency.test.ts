import { describe, it, expect } from "vitest";
import { computeV2 } from "@/lib/calculator/v2-compute";
import { computeBreakEven, estimateMedianRent } from "@/lib/finance";
import { SEED_TAX_RATES } from "@/lib/tax";
import type { PriceTierKey } from "@/lib/calculator/v2-types";

/**
 * §7.3 — front/back break-even consistency.
 *
 * The server precomputes each tier's g_star; the result page re-derives it
 * client-side from the same `cash_breakdown` fields. With identical default
 * inputs the two must agree (both call the shared `computeBreakEven`).
 */
describe("break-even front/back consistency", () => {
  const result = computeV2({
    solveParams: {
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
    },
    isFirstProperty: true,
    holdingYears: 7,
    rate: 0.0165,
    taxRatesVersion: "seed-2023-04-27",
  });

  (["comfortable", "balanced", "aggressive"] as PriceTierKey[]).forEach((key) => {
    it(`matches server g_star for ${key} at defaults`, () => {
      const cb = result.tiers[key].cash_breakdown;
      // Reproduce exactly what app/(tools)/calculator/page.tsx computes client-side.
      const client = computeBreakEven({
        price: cb.price,
        loanAmount: cb.loan_amount,
        upfrontCash: cb.down_payment_cash + cb.bsd + cb.absd + cb.legal_fees_est,
        monthlyRent: estimateMedianRent(result.tiers[key].midpoint),
        holdingYears: 7,
        tenureYears: 30,
        rate: 0.0165,
      });
      const server = result.break_even!.tiers[key].g_star;
      expect(Math.abs(client.g_star - server)).toBeLessThan(1e-3);
    });
  });
});
