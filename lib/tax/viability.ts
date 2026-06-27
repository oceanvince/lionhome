import type { SolveParams } from "./tdsr";
import { getLtvCap, minIncomeForLoan, estimateLegalFees } from "./tdsr";
import { calculateBsd } from "./bsd";
import { calculateAbsd } from "./absd";

/**
 * Below this price the calculator's three-tier output isn't meaningful (there's
 * effectively nothing realistic to buy), so the flow intercepts the buyer at
 * input time and tells them what it would take to clear the bar instead.
 *
 * Configurable: override via NEXT_PUBLIC_MIN_VIABLE_PRICE. As of 2026-06 the bar
 * is S$300k.
 */
const ENV_MIN = Number(process.env.NEXT_PUBLIC_MIN_VIABLE_PRICE);
export const MIN_VIABLE_PRICE = Number.isFinite(ENV_MIN) && ENV_MIN > 0 ? ENV_MIN : 300_000;

export interface Viability {
  /** The price floor below which the flow intercepts (= MIN_VIABLE_PRICE). */
  min_viable_price: number;
  /** Minimum family monthly income to borrow enough for a min-viable-price home (MAS TDSR cap). */
  min_monthly_income: number;
  /** Minimum down-payment budget (cash to close) for a min-viable-price home: down-payment + BSD + ABSD + legal. */
  min_down_payment: number;
}

/** What it would take to reach a min-viable-price home for this profile. */
export function computeViability(params: SolveParams, price: number = MIN_VIABLE_PRICE): Viability {
  const ltvCap = getLtvCap(params.age, params.tenureYears, params.propertyCount, params.ltvRules);
  const loan = price * ltvCap;

  const minAnnualIncome = minIncomeForLoan(
    loan,
    params.existingMonthlyDebt,
    params.tdsr,
    params.tenureYears,
    params.tdsr.cap
  );

  const downPayment = price - loan;
  const bsd = calculateBsd(price, params.bsdSlabs);
  const absd = calculateAbsd(price, params.residency, params.propertyCount, params.absdMatrix);
  const legal = estimateLegalFees(price);

  return {
    min_viable_price: price,
    min_monthly_income: Math.round(minAnnualIncome / 12),
    min_down_payment: Math.round(downPayment + bsd + absd + legal),
  };
}
