/**
 * Fit (适配度) — overlay the buyer's purchasing power on a project's price
 * (docs/CONDO_SEARCH_TD.md §4.2). Pure: reuses computeV2 + tax, no DB.
 *
 * Personalized → never cached in project_scores; computed per request.
 */

import { computeV2 } from "@/lib/calculator/v2-compute";
import { calculateAbsd, getAbsdRate } from "@/lib/tax";
import type { TaxRatesConfig, Residency } from "@/lib/tax";

/** Representative unit area for "price = PSF × area" (matches price-tab口径). */
export const TYPICAL_AREA_SQFT = 1000; // ~3-bed

export interface FitCalcInput {
  residency: Residency;
  existingProperties: number;
  annualIncome: number;
  age: number;
  availableCash: number;
  availableCpf: number;
  loanTenureYears: number;
  existingMonthlyDebt: number;
  displayRate: number;
}

export type FitStatus = "in_budget" | "slightly_over" | "over";

export interface FitResult {
  projectPriceFrom: number; // psf_min × typical area
  typicalAreaSqft: number;
  comfortRange: { low: number; high: number }; // comfortable.low → balanced.high
  recommendedMax: number; // balanced tier ceiling
  status: FitStatus;
  absd: number; // ABSD on the project's entry price
  absdRatePct: number;
}

/**
 * Compute fit for a project at `psfMin`. Returns null when there is no cached
 * PSF (can't reverse a price) — the page then shows「测一下买不买得起」.
 */
export function computeFit(args: {
  psfMin: number | null;
  calc: FitCalcInput;
  taxRates: TaxRatesConfig;
}): FitResult | null {
  const { psfMin, calc, taxRates } = args;
  if (!psfMin || psfMin <= 0) return null;

  const propertyCount = Math.min(calc.existingProperties + 1, 3);

  const v2 = computeV2({
    solveParams: {
      annualIncome: calc.annualIncome,
      existingMonthlyDebt: calc.existingMonthlyDebt,
      availableCash: calc.availableCash,
      availableCpf: calc.availableCpf,
      age: calc.age,
      tenureYears: calc.loanTenureYears,
      propertyCount,
      residency: calc.residency,
      bsdSlabs: taxRates.bsd_slabs,
      absdMatrix: taxRates.absd_matrix,
      ltvRules: taxRates.ltv_rules,
      tdsr: taxRates.tdsr,
      displayRate: calc.displayRate,
    },
    isFirstProperty: calc.existingProperties === 0,
    holdingYears: 7,
    rate: calc.displayRate,
    taxRatesVersion: "fit",
  });

  const projectPriceFrom = Math.round(psfMin * TYPICAL_AREA_SQFT);
  const comfortLow = v2.tiers.comfortable.price_low;
  const recommendedMax = v2.tiers.balanced.price_high;
  const aggressiveMax = v2.tiers.aggressive.price_high;

  const status: FitStatus =
    projectPriceFrom <= recommendedMax
      ? "in_budget"
      : projectPriceFrom <= aggressiveMax
        ? "slightly_over"
        : "over";

  return {
    projectPriceFrom,
    typicalAreaSqft: TYPICAL_AREA_SQFT,
    comfortRange: { low: comfortLow, high: recommendedMax },
    recommendedMax,
    status,
    absd: calculateAbsd(projectPriceFrom, calc.residency, propertyCount, taxRates.absd_matrix),
    absdRatePct: Number(
      (getAbsdRate(calc.residency, propertyCount, taxRates.absd_matrix) * 100).toFixed(2)
    ),
  };
}
