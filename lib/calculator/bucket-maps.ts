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

/** Build the V2 /compute request. tenure/holding/rate fall back to server defaults (30 / 7 / 1.65%). */
export function buildApiPayload(form: CalculatorFormState, age: number) {
  const residency = RESIDENCY_MAP[form.residency ?? "sc"];
  const foreigner = isForeigner(form.residency);

  return {
    residency,
    existing_properties: form.existingProperties,
    annual_income: toAmount(form.incomeMonthly) * 12,
    age,
    available_cash: toAmount(form.cash),
    available_cpf: foreigner ? 0 : toAmount(form.cpf),
    ...(form.timeline ? { timeline: form.timeline } : {}),
  };
}
