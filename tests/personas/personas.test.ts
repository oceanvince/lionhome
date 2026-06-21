/**
 * Persona regression gate — asserts the invariants the step-1 fixes guarantee.
 *
 * Unlike scripts/run-personas.ts (which prints a human-review report and never
 * fails), this is a hard CI gate. It runs all 58 fixtures through computeV2 and
 * asserts:
 *   1. finiteness        — no NaN/Infinity leaks into any tier number or g*
 *   2. legal-fees fix    — a non-infeasible tier's transaction cash ≤ available
 *      cash (Commit 1: isFeasibleAtPrice now counts legal fees)
 *   3. emergency-fund fix — a feasible tier leaves the reserve intact, i.e.
 *      cash_gap ≤ 0 (Commit 3: reserve folded into the feasibility constraint)
 *   4. fixture expects    — each persona's `expect` band/flag holds (Commit 2)
 */
import { describe, it, expect } from "vitest";
import { ALL_PERSONAS, toSolveParams, type Persona } from "./personas";
import { computeV2 } from "@/lib/calculator/v2-compute";
import type { TierData, V2ComputeResult } from "@/lib/calculator/v2-types";

function run(p: Persona): V2ComputeResult {
  return computeV2({
    solveParams: toSolveParams(p.input),
    isFirstProperty: p.input.existingProperties === 0,
    holdingYears: p.input.holdingYears,
    rate: p.input.rate,
    taxRatesVersion: "persona-test",
  });
}

const TIER_KEYS = ["comfortable", "balanced", "aggressive"] as const;

/** A tier that resolves to a real, buyable price (not blocked / not zero). */
function isLiveTier(t: TierData): boolean {
  return !t.cash_breakdown.infeasible_reason && t.midpoint > 0;
}

describe("persona regression gate", () => {
  ALL_PERSONAS.forEach((p) => {
    describe(`${p.id} — ${p.label}`, () => {
      const v2 = run(p);

      it("emits no NaN/Infinity in any tier number or g*", () => {
        for (const key of TIER_KEYS) {
          const cb = v2.tiers[key].cash_breakdown;
          for (const n of [
            v2.tiers[key].midpoint,
            v2.tiers[key].price_low,
            v2.tiers[key].price_high,
            cb.transaction_cash_total,
            cb.total_cash_needed,
            cb.cash_gap,
            cb.loan_amount,
            cb.monthly_payment.base,
            cb.monthly_payment.stress,
          ]) {
            expect(Number.isFinite(n)).toBe(true);
          }
        }
        if (v2.break_even) {
          for (const key of TIER_KEYS) {
            expect(Number.isFinite(v2.break_even.tiers[key].g_star)).toBe(true);
          }
        }
      });

      it("Commit 1: a non-infeasible tier's transaction cash ≤ available cash", () => {
        for (const key of TIER_KEYS) {
          const t = v2.tiers[key];
          if (!isLiveTier(t)) continue;
          expect(t.cash_breakdown.transaction_cash_total).toBeLessThanOrEqual(
            p.input.availableCash
          );
        }
      });

      it("Commit 3: a feasible tier leaves the emergency reserve intact (cash_gap ≤ 0)", () => {
        for (const key of TIER_KEYS) {
          const t = v2.tiers[key];
          if (!isLiveTier(t)) continue;
          expect(t.cash_breakdown.cash_gap).toBeLessThanOrEqual(0);
        }
      });

      if (p.expect) {
        const e = p.expect;
        const bal = v2.tiers.balanced;
        const txnAffordable =
          !bal.cash_breakdown.infeasible_reason &&
          p.input.availableCash >= bal.cash_breakdown.transaction_cash_total;

        if (e.feasible === true) {
          it("Commit 2: expected feasible — balanced transaction is affordable", () => {
            expect(txnAffordable).toBe(true);
          });
        }
        if (e.feasible === false) {
          it("Commit 2: expected infeasible — balanced transaction is NOT affordable", () => {
            expect(txnAffordable).toBe(false);
          });
        }
        if (e.balancedMidRange) {
          const [lo, hi] = e.balancedMidRange;
          it(`balanced midpoint within [${lo}, ${hi}]`, () => {
            const mid = (bal.price_low + bal.price_high) / 2;
            expect(mid).toBeGreaterThanOrEqual(lo);
            expect(mid).toBeLessThanOrEqual(hi);
          });
        }
        if (e.breakEvenBalanced && v2.break_even) {
          const [lo, hi] = e.breakEvenBalanced;
          it(`balanced break-even g* within [${lo}, ${hi}]`, () => {
            const g = v2.break_even!.tiers.balanced.g_star;
            expect(g).toBeGreaterThanOrEqual(lo);
            expect(g).toBeLessThanOrEqual(hi);
          });
        }
      }
    });
  });
});
