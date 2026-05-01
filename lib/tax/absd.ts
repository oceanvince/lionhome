import type { AbsdMatrixEntry, Residency } from "./types";

/**
 * Returns the ABSD rate for a given residency × property-count combination.
 * Property counts >= 3 collapse to the "3" tier.
 *
 * Reference: PRD Section 24.2 — rates are admin-configurable, never hardcoded.
 */
export function getAbsdRate(
  residency: Residency,
  propertyCount: number,
  matrix: AbsdMatrixEntry[]
): number {
  const tier = propertyCount >= 3 ? 3 : propertyCount === 2 ? 2 : 1;
  const entry = matrix.find((e) => e.residency === residency && e.property_count === tier);
  if (!entry) {
    throw new Error(`No ABSD rate configured for residency=${residency}, property_count=${tier}`);
  }
  return entry.rate;
}

export function calculateAbsd(
  price: number,
  residency: Residency,
  propertyCount: number,
  matrix: AbsdMatrixEntry[]
): number {
  if (price <= 0) return 0;
  const rate = getAbsdRate(residency, propertyCount, matrix);
  return Math.round(price * rate * 100) / 100;
}
