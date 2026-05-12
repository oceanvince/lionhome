import type { CalculatorFormState, ResidencyOption } from "./form-types";

export const INCOME_BUCKETS = [
  { label: "15 万以下", mid: 120_000 },
  { label: "15 – 25 万", mid: 200_000 },
  { label: "25 – 35 万", mid: 300_000 },
  { label: "35 – 50 万", mid: 425_000 },
  { label: "50 – 75 万", mid: 625_000 },
  { label: "75 – 100 万", mid: 875_000 },
  { label: "100 – 150 万", mid: 1_250_000 },
  { label: "150 万以上", mid: 1_800_000 },
] as const;

export const CASH_BUCKETS = [
  { label: "20 万以下", mid: 150_000 },
  { label: "20 – 50 万", mid: 350_000 },
  { label: "50 – 100 万", mid: 750_000 },
  { label: "100 – 200 万", mid: 1_500_000 },
  { label: "200 万以上", mid: 2_500_000 },
] as const;

export const CPF_BUCKETS = [
  { label: "10 万以下", mid: 50_000 },
  { label: "10 – 30 万", mid: 200_000 },
  { label: "30 – 60 万", mid: 450_000 },
  { label: "60 – 100 万", mid: 800_000 },
  { label: "100 万以上", mid: 1_250_000 },
] as const;

export const DEBT_BUCKETS = [
  { label: "无", mid: 0 },
  { label: "1,000 – 3,000", mid: 2_000 },
  { label: "3,000 – 5,000", mid: 4_000 },
  { label: "5,000 – 1 万", mid: 7_500 },
  { label: "1 万以上", mid: 12_000 },
] as const;

const RESIDENCY_MAP: Record<ResidencyOption, "citizen" | "pr" | "foreigner"> = {
  sc: "citizen",
  pr: "pr",
  foreigner_wp: "foreigner",
  foreigner_none: "foreigner",
};

export function isForeigner(residency: ResidencyOption | null): boolean {
  return residency === "foreigner_wp" || residency === "foreigner_none";
}

export function buildApiPayload(form: CalculatorFormState) {
  const residency = RESIDENCY_MAP[form.residency ?? "sc"];
  const foreigner = isForeigner(form.residency);

  return {
    residency,
    marital_status: "single" as const,
    spouse_residency: undefined,
    existing_properties: form.existingProperties,
    annual_income: INCOME_BUCKETS[form.incomeBucket]?.mid ?? 300_000,
    age: form.age,
    employment_type: "salaried" as const,
    existing_monthly_debt: DEBT_BUCKETS[form.debtBucket]?.mid ?? 0,
    available_cash: CASH_BUCKETS[form.cashBucket]?.mid ?? 350_000,
    available_cpf: foreigner ? 0 : (CPF_BUCKETS[form.cpfBucket]?.mid ?? 200_000),
    loan_tenure_years: form.tenure,
    property_type_pref: form.propertyType ?? "either",
  };
}
