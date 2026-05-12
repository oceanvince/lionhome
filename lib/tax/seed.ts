import type { TaxRatesConfig } from "./types";

// Singapore tax rates as at 2023 (post-April 2023 ABSD hike).
// Used as a fallback when the tax_rates table is empty and URA sync fails.
export const SEED_TAX_RATES: TaxRatesConfig = {
  effective_from: "2023-04-27",
  bsd_slabs: [
    { threshold_sgd: 0, rate: 0.01 },
    { threshold_sgd: 180_000, rate: 0.02 },
    { threshold_sgd: 360_000, rate: 0.03 },
    { threshold_sgd: 1_000_000, rate: 0.04 },
    { threshold_sgd: 1_500_000, rate: 0.05 },
    { threshold_sgd: 3_000_000, rate: 0.06 },
  ],
  absd_matrix: [
    // Singapore Citizens
    { residency: "citizen", property_count: 1, rate: 0.0 },
    { residency: "citizen", property_count: 2, rate: 0.2 },
    { residency: "citizen", property_count: 3, rate: 0.3 },
    // Permanent Residents
    { residency: "pr", property_count: 1, rate: 0.05 },
    { residency: "pr", property_count: 2, rate: 0.3 },
    { residency: "pr", property_count: 3, rate: 0.35 },
    // Foreigners
    { residency: "foreigner", property_count: 1, rate: 0.6 },
    { residency: "foreigner", property_count: 2, rate: 0.6 },
    { residency: "foreigner", property_count: 3, rate: 0.6 },
    // Companies
    { residency: "company", property_count: 1, rate: 0.65 },
    { residency: "company", property_count: 2, rate: 0.65 },
    { residency: "company", property_count: 3, rate: 0.65 },
  ],
  ltv_rules: [
    { scenario: "standard_75pct", ltv_cap: 0.75 },
    { scenario: "age_tenor_over_65", ltv_cap: 0.55 },
    { scenario: "second_property", ltv_cap: 0.45 },
  ],
  tdsr: {
    cap: 0.55,
    stress_rate: 0.04,
  },
  msr: {
    cap: 0.3,
  },
};
