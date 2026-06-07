export type ResidencyOption = "sc" | "pr" | "foreigner_wp" | "foreigner_none";
export type Timeline = "6m" | "1y" | "explore";

export interface CalculatorFormState {
  // Step 1 · 您和这次买房
  residency: ResidencyOption | null;
  existingProperties: 0 | 1 | 2; // 2 = "2+"
  age: number;

  // Step 2 · 您的钱 — manual entry, stored as digit strings (so the field can be cleared).
  incomeMonthly: string; // family pre-tax monthly income, SGD
  cash: string; // usable cash (excl. CPF), SGD
  cpf: string; // CPF OA balance, SGD (ignored for foreigners)

  // Step 3 · 您的计划 (lead label only)
  timeline: Timeline | null;
}

export const INITIAL_FORM: CalculatorFormState = {
  residency: null,
  existingProperties: 0,
  age: 35,
  incomeMonthly: "",
  cash: "",
  cpf: "",
  timeline: null,
};
