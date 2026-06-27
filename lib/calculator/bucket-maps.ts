import type { CalculatorFormState, ResidencyOption } from "./form-types";

const RESIDENCY_MAP: Record<ResidencyOption, "citizen" | "pr" | "foreigner"> = {
  sc: "citizen",
  pr: "pr",
  foreigner_wp: "foreigner",
  foreigner_none: "foreigner",
};

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
