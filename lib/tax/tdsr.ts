import type { BsdSlab, AbsdMatrixEntry, LtvRule, TdsrConfig } from "./types";
import { calculateBsd, calculateAbsd } from "./index";

export interface CalcOutputs {
  max_price: number;
  loan_amount: number;
  ltv_cap: number;
  down_payment: { cash: number; cpf: number };
  bsd: number;
  absd: number;
  absd_rate: number;
  legal_fees_est: number;
  total_upfront_cash: number;
  monthly_payment: { base: number; stress: number };
  tdsr_utilization: number;
  absd_warning: boolean;
  infeasible_reason: "TDSR_EXCEEDED" | "INSUFFICIENT_CASH" | null;
  scenarios: ScenarioRow[];
}

export interface ScenarioRow {
  label: string;
  price: number;
  loan: number;
  monthly_base: number;
  monthly_stress: number;
  upfront_cash: number;
}

function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  if (annualRate === 0) return principal / (years * 12);
  const i = annualRate / 12;
  const N = years * 12;
  return (principal * i * Math.pow(1 + i, N)) / (Math.pow(1 + i, N) - 1);
}

function getLtvCap(
  age: number,
  tenureYears: number,
  propertyCount: number,
  _ltvRules: LtvRule[]
): number {
  // Property count >= 2 → lower LTV
  if (propertyCount >= 2) return 0.45;
  // Age + tenure > 65 → lower LTV
  if (age + tenureYears > 65) return 0.55;
  return 0.75;
}

// Max loan under a monthly-payment-to-income ratio constraint.
// The amortisation is always done at the MAS stress rate (4%); only the
// income ratio (cap) varies — this is what V2's three tiers (0.30/0.35/0.55) switch.
function maxLoanByRatio(
  annualIncome: number,
  existingMonthlyDebt: number,
  tdsr: TdsrConfig,
  tenureYears: number,
  monthlyRatio: number
): number {
  const monthlyIncome = annualIncome / 12;
  const allowed = monthlyIncome * monthlyRatio - existingMonthlyDebt;
  if (allowed <= 0) return 0;
  const i = tdsr.stress_rate / 12;
  const N = tenureYears * 12;
  // P = PMT × ((1+i)^N − 1) / (i × (1+i)^N)
  const loan = (allowed * (Math.pow(1 + i, N) - 1)) / (i * Math.pow(1 + i, N));
  return Math.max(0, loan);
}

export interface SolveParams {
  annualIncome: number;
  existingMonthlyDebt: number;
  availableCash: number;
  availableCpf: number;
  age: number;
  tenureYears: number;
  propertyCount: number;
  residency: "citizen" | "pr" | "foreigner" | "company";
  bsdSlabs: BsdSlab[];
  absdMatrix: AbsdMatrixEntry[];
  ltvRules: LtvRule[];
  tdsr: TdsrConfig;
  displayRate: number;
}

export function isFeasibleAtPrice(
  price: number,
  params: SolveParams,
  monthlyRatio: number = params.tdsr.cap
): boolean {
  const ltvCap = getLtvCap(params.age, params.tenureYears, params.propertyCount, params.ltvRules);
  const maxLoanTdsr = maxLoanByRatio(
    params.annualIncome,
    params.existingMonthlyDebt,
    params.tdsr,
    params.tenureYears,
    monthlyRatio
  );
  const maxLoanLtv = price * ltvCap;
  const loan = Math.min(maxLoanTdsr, maxLoanLtv);
  const downPayment = price - loan;
  // Private property: at least 5% must be cash
  const cashMinimum = price * 0.05;
  if (downPayment < cashMinimum) return false;
  const cpfUsed = Math.min(params.availableCpf, downPayment - cashMinimum);
  const cashDown = downPayment - cpfUsed;
  const bsd = calculateBsd(price, params.bsdSlabs);
  const absd = calculateAbsd(price, params.residency, params.propertyCount, params.absdMatrix);
  const totalCashNeeded = cashDown + bsd + absd;
  return totalCashNeeded <= params.availableCash;
}

// Backward-compatible: max price at the MAS TDSR cap (55%).
export function solveMaxPurchasePrice(params: SolveParams): CalcOutputs {
  return solveByMonthlyRatio(params.tdsr.cap, params);
}

// V2 core: max feasible price under a given monthly-payment-to-income ratio.
export function solveByMonthlyRatio(monthlyRatio: number, params: SolveParams): CalcOutputs {
  const maxLoanTdsr = maxLoanByRatio(
    params.annualIncome,
    params.existingMonthlyDebt,
    params.tdsr,
    params.tenureYears,
    monthlyRatio
  );

  if (maxLoanTdsr <= 0) {
    return buildOutput(0, params, "TDSR_EXCEEDED", monthlyRatio);
  }

  // Binary search for max feasible price
  let lo = 0;
  let hi = 30_000_000; // SGD 30M upper bound

  // Quick check if even a tiny price is feasible
  if (!isFeasibleAtPrice(1, params, monthlyRatio)) {
    return buildOutput(0, params, "INSUFFICIENT_CASH", monthlyRatio);
  }

  for (let iter = 0; iter < 60; iter++) {
    const mid = Math.floor((lo + hi) / 2);
    if (isFeasibleAtPrice(mid, params, monthlyRatio)) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo <= 1000) break;
  }

  // Round down to nearest $10k
  const maxPrice = Math.floor(lo / 10_000) * 10_000;

  if (maxPrice === 0) {
    return buildOutput(0, params, "INSUFFICIENT_CASH", monthlyRatio);
  }

  return buildOutput(maxPrice, params, null, monthlyRatio);
}

export function buildOutput(
  price: number,
  params: SolveParams,
  infeasibleReason: CalcOutputs["infeasible_reason"],
  monthlyRatio: number = params.tdsr.cap
): CalcOutputs {
  if (price === 0) {
    const emptyDown = { cash: 0, cpf: 0 };
    return {
      max_price: 0,
      loan_amount: 0,
      ltv_cap: 0.75,
      down_payment: emptyDown,
      bsd: 0,
      absd: 0,
      absd_rate: 0,
      legal_fees_est: 0,
      total_upfront_cash: 0,
      monthly_payment: { base: 0, stress: 0 },
      tdsr_utilization: 0,
      absd_warning: false,
      infeasible_reason: infeasibleReason,
      scenarios: [],
    };
  }

  const ltvCap = getLtvCap(params.age, params.tenureYears, params.propertyCount, params.ltvRules);
  const maxLoanTdsr = maxLoanByRatio(
    params.annualIncome,
    params.existingMonthlyDebt,
    params.tdsr,
    params.tenureYears,
    monthlyRatio
  );
  const loan = Math.min(maxLoanTdsr, price * ltvCap);
  const downPayment = price - loan;
  const cashMinimum = price * 0.05;
  const cpfUsed = Math.min(params.availableCpf, downPayment - cashMinimum);
  const cashDown = downPayment - cpfUsed;
  const bsd = calculateBsd(price, params.bsdSlabs);
  const absd = calculateAbsd(price, params.residency, params.propertyCount, params.absdMatrix);
  // Simple legal fees estimate: mortgage stamp ($500) + conveyancing + valuation
  const legalFees = Math.round(500 + Math.min(3500, price * 0.002));
  const totalCash = cashDown + bsd + absd;

  const monthlyBase = monthlyPayment(loan, params.displayRate, params.tenureYears);
  const monthlyStress = monthlyPayment(loan, params.tdsr.stress_rate, params.tenureYears);
  const monthlyIncome = params.annualIncome / 12;
  const tdsrUtil =
    monthlyIncome > 0 ? (monthlyStress + params.existingMonthlyDebt) / monthlyIncome : 0;

  // absd_rate for this profile
  const absdRate = price > 0 ? absd / price : 0;
  const absdWarning = absdRate >= 0.6;

  // Generate 3 price scenarios: -20%, main, +20%
  const scenarios: ScenarioRow[] = [0.8, 1.0, 1.2].map((factor) => {
    const sp = Math.round((price * factor) / 10_000) * 10_000;
    const sl = Math.min(maxLoanTdsr, sp * ltvCap);
    const sbsd = calculateBsd(sp, params.bsdSlabs);
    const sabsd = calculateAbsd(sp, params.residency, params.propertyCount, params.absdMatrix);
    const sDown = sp - sl;
    const sCashMin = sp * 0.05;
    const sCpf = Math.min(params.availableCpf, sDown - sCashMin);
    const sCash = sDown - sCpf + sbsd + sabsd;
    return {
      label: factor === 0.8 ? "保守" : factor === 1.0 ? "参考" : "进取",
      price: sp,
      loan: Math.round(sl),
      monthly_base: Math.round(monthlyPayment(sl, params.displayRate, params.tenureYears)),
      monthly_stress: Math.round(monthlyPayment(sl, params.tdsr.stress_rate, params.tenureYears)),
      upfront_cash: Math.max(0, Math.round(sCash)),
    };
  });

  return {
    max_price: price,
    loan_amount: Math.round(loan),
    ltv_cap: ltvCap,
    down_payment: {
      cash: Math.round(cashDown),
      cpf: Math.round(cpfUsed),
    },
    bsd: Math.round(bsd),
    absd: Math.round(absd),
    absd_rate: absdRate,
    legal_fees_est: legalFees,
    total_upfront_cash: Math.round(totalCash),
    monthly_payment: {
      base: Math.round(monthlyBase),
      stress: Math.round(monthlyStress),
    },
    tdsr_utilization: Math.round(tdsrUtil * 1000) / 1000,
    absd_warning: absdWarning,
    infeasible_reason: infeasibleReason,
    scenarios,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   V2 — Three rational price tiers
   comfortable / balanced are product-set caps (30% / 35%);
   aggressive uses the configurable MAS TDSR cap (normally 55%).
   All caps are measured at the stress rate, consistent with MAS TDSR.
───────────────────────────────────────────────────────────────────── */

export const COMFORT_RATIO = 0.3;
export const BALANCED_RATIO = 0.35;

// Lower bound of the comfortable band as a fraction of its own upper bound.
const COMFORT_BAND_FLOOR = 0.8;
const MIN_TIER_FLOOR = 500_000;

export type PriceTierKey = "comfortable" | "balanced" | "aggressive";

export interface PriceTier {
  ratio: number;
  price_low: number;
  price_high: number;
  midpoint: number;
  /** Full cost breakdown computed at the band midpoint. */
  output: CalcOutputs;
}

export interface TiersResult {
  comfortable: PriceTier;
  balanced: PriceTier;
  aggressive: PriceTier;
  /** True when cash/LTV (not the income ratio) is the binding constraint, so all bands collapse to one price. */
  degenerate: boolean;
}

function round10k(n: number): number {
  return Math.round(n / 10_000) * 10_000;
}

function makeTier(low: number, high: number, ratio: number, params: SolveParams): PriceTier {
  const price_low = Math.max(0, round10k(low));
  const price_high = Math.max(price_low, round10k(high));
  const midpoint = round10k((price_low + price_high) / 2);
  const reason = price_high === 0 ? ("INSUFFICIENT_CASH" as const) : null;
  return {
    ratio,
    price_low,
    price_high,
    midpoint,
    output: buildOutput(midpoint, params, reason, ratio),
  };
}

export function computeTiers(params: SolveParams): TiersResult {
  const aggressiveRatio = params.tdsr.cap;
  const comfortMax = solveByMonthlyRatio(COMFORT_RATIO, params).max_price;
  const balancedMax = solveByMonthlyRatio(BALANCED_RATIO, params).max_price;
  const aggressiveMax = solveByMonthlyRatio(aggressiveRatio, params).max_price;

  // Cash/LTV binds (not the income ratio) → all three converge to one price.
  const degenerate = comfortMax > 0 && aggressiveMax <= comfortMax;

  const comfortLow = Math.max(MIN_TIER_FLOOR, comfortMax * COMFORT_BAND_FLOOR);

  return {
    comfortable: makeTier(Math.min(comfortLow, comfortMax), comfortMax, COMFORT_RATIO, params),
    balanced: makeTier(comfortMax, balancedMax, BALANCED_RATIO, params),
    aggressive: makeTier(balancedMax, aggressiveMax, aggressiveRatio, params),
    degenerate,
  };
}
