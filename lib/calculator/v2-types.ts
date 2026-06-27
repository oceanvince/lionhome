import type { CalcOutputs, PriceTierKey, Viability } from "@/lib/tax";

export type { PriceTierKey, Viability };

/** Cash needed to transact at a tier's midpoint price, plus the suggested emergency fund. */
export interface CashBreakdown {
  price: number;
  loan_amount: number;
  ltv_cap: number;
  down_payment_total: number;
  down_payment_cash: number;
  down_payment_cpf: number;
  bsd: number;
  absd: number;
  absd_rate: number;
  legal_fees_est: number;
  /** down-payment cash + BSD + ABSD + fees (the cash that must be on hand to close). */
  transaction_cash_total: number;
  /** Same as transaction_cash_total now that the emergency-fund buffer is gone. */
  total_cash_needed: number;
  /** total_cash_needed − available cash; positive = short. */
  cash_gap: number;
  monthly_payment: { base: number; stress: number };
  tdsr_utilization: number;
  infeasible_reason: CalcOutputs["infeasible_reason"];
}

export interface TierData {
  ratio: number;
  price_low: number;
  price_high: number;
  midpoint: number;
  cash_breakdown: CashBreakdown;
  monthly: { base: number; stress: number };
  /** Stress-rate monthly payment as a fraction of monthly income (matches the 30/35/55 cap口径). */
  monthly_pct_of_income: number;
}

export interface BreakEvenTierData {
  g_star: number;
  clamped: "below" | "above" | null;
}

export interface BreakEvenData {
  is_first_property: boolean;
  median_rent_estimate: number;
  default_holding_years: number;
  default_tenure_years: number;
  default_rate: number;
  regional_historical: number;
  tiers: Record<PriceTierKey, BreakEvenTierData>;
}

export interface V2ComputeResult {
  tax_rates_version: string;
  tiers: Record<PriceTierKey, TierData>;
  break_even: BreakEvenData | null;
  /** Min income / down-payment to reach a viable home; drives the input-time intercept when the max tier falls below the bar. */
  viability: Viability;
  /** True when cash/LTV caps all three tiers to one price. */
  degenerate: boolean;
  /** Old "max you can buy" (= 55% TDSR cap). Kept for the legacy result page during migration. */
  legacy_max_price: number;
  /** Legacy V1 payload (aggressive-tier CalcOutputs) so the old result page keeps working mid-migration. Remove after PR4. */
  outputs: CalcOutputs;
  schema_version: "v2";
}
