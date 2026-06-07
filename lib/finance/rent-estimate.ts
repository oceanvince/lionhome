/**
 * Median rent estimate + regional appreciation reference.
 *
 * MVP: rent is derived from price via a price-banded gross rental yield, and
 * appreciation is a single whole-city figure. v2.1 will source URA quarterly
 * rental-contract data and break appreciation down by district (CCR/RCR/OCR).
 */

const ANNUAL_YIELD_BY_PRICE: { upTo: number; yield: number }[] = [
  { upTo: 1_000_000, yield: 0.032 }, // smaller units — higher yield
  { upTo: 2_000_000, yield: 0.028 }, // mainstream family units
  { upTo: 5_000_000, yield: 0.024 }, // larger units
  { upTo: Infinity, yield: 0.02 }, // luxury
];

/** Estimated median monthly rent for a property at `price`, rounded to nearest $100. */
export function estimateMedianRent(price: number): number {
  if (price <= 0) return 0;
  const tier = ANNUAL_YIELD_BY_PRICE.find((t) => price <= t.upTo)!;
  return Math.round((price * tier.yield) / 12 / 100) * 100;
}

export interface AppreciationReference {
  decade: number;
  five_year: number;
  source: string;
  last_updated: string;
}

const WHOLE_CITY: AppreciationReference = {
  decade: 0.028,
  five_year: 0.018,
  source: "URA PPI 2014–2024",
  last_updated: "2025-Q1",
};

export const HISTORICAL_APPRECIATION: Record<string, AppreciationReference> = {
  whole_city: WHOLE_CITY,
};

/** Regional historical appreciation reference. MVP returns the whole-city figure. */
export function regionalAppreciationLookup(_district?: string): AppreciationReference {
  return WHOLE_CITY;
}
