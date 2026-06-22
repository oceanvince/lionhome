import { computeTiers, solveMaxPurchasePrice, EMERGENCY_FUND_RATIO } from "@/lib/tax";
import type { CalcOutputs, PriceTier, PriceTierKey, SolveParams } from "@/lib/tax";
import {
  breakEvenFromCalcOutputs,
  estimateMedianRent,
  regionalAppreciationLookup,
} from "@/lib/finance";
import type {
  BreakEvenData,
  BreakEvenTierData,
  CashBreakdown,
  TierData,
  V2ComputeResult,
} from "./v2-types";

export interface V2ComputeParams {
  solveParams: SolveParams;
  /** Whether this is the buyer's first property (controls break-even visibility). */
  isFirstProperty: boolean;
  holdingYears: number;
  /** Display mortgage rate (not the stress rate). */
  rate: number;
  taxRatesVersion: string;
}

function buildCashBreakdown(
  output: CalcOutputs,
  annualIncome: number,
  availableCash: number
): CashBreakdown {
  const transactionCash =
    output.down_payment.cash + output.bsd + output.absd + output.legal_fees_est;
  const emergency = Math.round(annualIncome * EMERGENCY_FUND_RATIO);
  const totalCashNeeded = transactionCash + emergency;
  return {
    price: output.max_price,
    loan_amount: output.loan_amount,
    ltv_cap: output.ltv_cap,
    down_payment_total: output.down_payment.cash + output.down_payment.cpf,
    down_payment_cash: output.down_payment.cash,
    down_payment_cpf: output.down_payment.cpf,
    bsd: output.bsd,
    absd: output.absd,
    absd_rate: output.absd_rate,
    legal_fees_est: output.legal_fees_est,
    transaction_cash_total: Math.round(transactionCash),
    emergency_fund_suggested: emergency,
    total_cash_needed: Math.round(totalCashNeeded),
    cash_gap: Math.round(totalCashNeeded - availableCash),
    monthly_payment: output.monthly_payment,
    tdsr_utilization: output.tdsr_utilization,
    infeasible_reason: output.infeasible_reason,
  };
}

function toTierData(tier: PriceTier, annualIncome: number, availableCash: number): TierData {
  const monthlyIncome = annualIncome / 12;
  return {
    ratio: tier.ratio,
    price_low: tier.price_low,
    price_high: tier.price_high,
    midpoint: tier.midpoint,
    cash_breakdown: buildCashBreakdown(tier.output, annualIncome, availableCash),
    monthly: tier.output.monthly_payment,
    monthly_pct_of_income:
      monthlyIncome > 0
        ? Math.round((tier.output.monthly_payment.stress / monthlyIncome) * 1000) / 1000
        : 0,
  };
}

function tierBreakEven(
  tier: PriceTier,
  holdingYears: number,
  tenureYears: number,
  rate: number
): BreakEvenTierData {
  if (tier.midpoint <= 0) return { g_star: 0, clamped: null };
  const { g_star, clamped } = breakEvenFromCalcOutputs(tier.output, {
    monthlyRent: estimateMedianRent(tier.midpoint),
    holdingYears,
    tenureYears,
    rate,
  });
  return { g_star: Math.round(g_star * 10000) / 10000, clamped };
}

export function computeV2(p: V2ComputeParams): V2ComputeResult {
  const { solveParams, isFirstProperty, holdingYears, rate, taxRatesVersion } = p;
  const { annualIncome, availableCash, tenureYears } = solveParams;

  const t = computeTiers(solveParams);

  const tiers: Record<PriceTierKey, TierData> = {
    comfortable: toTierData(t.comfortable, annualIncome, availableCash),
    balanced: toTierData(t.balanced, annualIncome, availableCash),
    aggressive: toTierData(t.aggressive, annualIncome, availableCash),
  };

  let breakEven: BreakEvenData | null = null;
  if (isFirstProperty) {
    breakEven = {
      is_first_property: true,
      median_rent_estimate: estimateMedianRent(t.balanced.midpoint),
      default_holding_years: holdingYears,
      default_tenure_years: tenureYears,
      default_rate: rate,
      regional_historical: regionalAppreciationLookup().decade,
      tiers: {
        comfortable: tierBreakEven(t.comfortable, holdingYears, tenureYears, rate),
        balanced: tierBreakEven(t.balanced, holdingYears, tenureYears, rate),
        aggressive: tierBreakEven(t.aggressive, holdingYears, tenureYears, rate),
      },
    };
  }

  return {
    tax_rates_version: taxRatesVersion,
    tiers,
    break_even: breakEven,
    degenerate: t.degenerate,
    legacy_max_price: t.aggressive.price_high,
    outputs: solveMaxPurchasePrice(solveParams),
    schema_version: "v2",
  };
}
