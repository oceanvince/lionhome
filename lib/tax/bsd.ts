import type { BsdSlab } from "./types";

/**
 * Computes Buyer's Stamp Duty using progressive slabs.
 * Slabs must be sorted ascending by threshold_sgd (first must be 0).
 *
 * Reference: PRD Section 24.1 — slabs are admin-configurable, never hardcoded.
 */
export function calculateBsd(price: number, slabs: BsdSlab[]): number {
  if (price <= 0) return 0;
  if (slabs.length === 0) {
    throw new Error("BSD slabs must not be empty");
  }
  const sorted = [...slabs].sort((a, b) => a.threshold_sgd - b.threshold_sgd);
  let bsd = 0;
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (!current) break;
    if (price <= current.threshold_sgd) break;
    const upper = next ? Math.min(price, next.threshold_sgd) : price;
    const lower = current.threshold_sgd;
    if (upper > lower) {
      bsd += (upper - lower) * current.rate;
    }
  }
  return Math.round(bsd * 100) / 100;
}
