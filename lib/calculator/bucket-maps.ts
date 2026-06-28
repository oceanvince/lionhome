import type { CalculatorFormState, ResidencyOption } from "./form-types";
import { SEED_TAX_RATES, computeViability } from "@/lib/tax";
import type { SolveParams } from "@/lib/tax";

const RESIDENCY_MAP: Record<ResidencyOption, "citizen" | "pr" | "foreigner"> = {
  sc: "citizen",
  pr: "pr",
  foreigner_wp: "foreigner",
  foreigner_none: "foreigner",
};

// Default loan tenure mirrors the server (ComputeSchema.loan_tenure_years default).
const DEFAULT_TENURE_YEARS = 30;

export function isForeigner(residency: ResidencyOption | null): boolean {
  return residency === "foreigner_wp" || residency === "foreigner_none";
}

/** Parse a digit string to a non-negative number; empty / invalid → 0. */
export function toAmount(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sentinel sent when the buyer leaves the target down-payment blank: cash never
 *  binds, so price is limited only by income/LTV. */
export const UNBOUNDED_DOWN_PAYMENT = 1_000_000_000_000;

/** Build the V2 /compute request. tenure/holding/rate fall back to server defaults (30 / 7 / 1.65%). */
export function buildApiPayload(form: CalculatorFormState, age: number) {
  const residency = RESIDENCY_MAP[form.residency ?? "sc"];
  const target = toAmount(form.targetDownPayment);

  return {
    residency,
    existing_properties: form.existingProperties,
    annual_income: toAmount(form.incomeMonthly) * 12,
    age,
    // Target down payment is the cash-to-close budget. Blank → unbounded.
    available_cash: target > 0 ? target : UNBOUNDED_DOWN_PAYMENT,
    available_cpf: 0,
    ...(form.timeline ? { timeline: form.timeline } : {}),
  };
}

/**
 * Minimum target down payment (cash to close) for the cheapest viable home, given
 * the buyer's identity/property-count/age. Used to intercept a too-low target down
 * payment at input time, before any compute call. Uses seed tax rates (the server
 * fallback), so it stays in step with the engine without a round-trip.
 */
export function minDownPaymentForViable(form: CalculatorFormState, age: number): number {
  const params: SolveParams = {
    annualIncome: toAmount(form.incomeMonthly) * 12,
    existingMonthlyDebt: 0,
    availableCash: 0,
    availableCpf: 0,
    age,
    tenureYears: DEFAULT_TENURE_YEARS,
    propertyCount: Math.min(form.existingProperties + 1, 3),
    residency: RESIDENCY_MAP[form.residency ?? "sc"],
    bsdSlabs: SEED_TAX_RATES.bsd_slabs,
    absdMatrix: SEED_TAX_RATES.absd_matrix,
    ltvRules: SEED_TAX_RATES.ltv_rules,
    tdsr: SEED_TAX_RATES.tdsr,
    displayRate: 0.0165,
  };
  return computeViability(params).min_down_payment;
}
