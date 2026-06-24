import type { SolveParams } from "./tdsr";
import { getLtvCap, minIncomeForLoan, estimateLegalFees, EMERGENCY_FUND_RATIO } from "./tdsr";
import { calculateBsd } from "./bsd";
import { calculateAbsd } from "./absd";

/**
 * Cheapest realistic owner-occupied private home in Singapore — the market floor
 * shown when a buyer's profile can't support any tier. Single, configurable source
 * of truth; override via the NEXT_PUBLIC_PRIVATE_FLOOR_PRICE env var, or replace
 * `price` with a live URA floor once that transaction feed lands.
 *
 * As of 2026-06: OCR resale 1-bedroom units transact ~S$0.55–0.67M; absolute
 * outliers (old mixed-use / micro units) dip to ~S$0.50M but are effectively
 * rental stock. S$600k sits just above those outliers = a unit you'd actually
 * live in and finance.
 */
const ENV_FLOOR = Number(process.env.NEXT_PUBLIC_PRIVATE_FLOOR_PRICE);

export const PRIVATE_FLOOR = {
  price: Number.isFinite(ENV_FLOOR) && ENV_FLOOR > 0 ? ENV_FLOOR : 600_000,
  as_of: "2026-06",
  source: "URA resale OCR 1-bedroom transactions (~S$0.55–0.67M)",
} as const;

export interface MarketFloor {
  floor_price: number;
  floor_as_of: string;

  // ── Cash gate — assumes the buyer qualifies for the standard LTV loan. ──
  ltv_cap: number;
  loan_amount: number;
  down_payment_cash: number;
  down_payment_cpf: number;
  bsd: number;
  absd: number;
  legal_fees_est: number;
  /** Hard minimum cash to close: down-payment cash + BSD + ABSD + legal fees. */
  min_cash_transaction: number;
  /** Suggested buffer on top (≈ 6.6 months of income), shown separately. */
  emergency_fund: number;

  // ── Income gate — assumes the buyer has the cash. ──
  /** Minimum monthly income to service the floor-price loan at the MAS TDSR cap. */
  min_monthly_income: number;

  // ── The buyer's current standing vs each gate. ──
  available_cash: number;
  /** min_cash_transaction − available cash; positive = short. */
  cash_gap: number;
  cash_ok: boolean;
  monthly_income: number;
  /** min_monthly_income − current monthly income; positive = short. */
  income_gap: number;
  income_ok: boolean;
}

/**
 * What it would take for this profile to buy the cheapest private home.
 *
 * The two gates are computed independently — cash assumes the loan is approved,
 * income assumes the cash is in hand — so the buyer can see exactly which one
 * (or both) is binding, without the gaps double-counting each other.
 */
export function computeMarketFloor(
  params: SolveParams,
  floorPrice: number = PRIVATE_FLOOR.price
): MarketFloor {
  const price = floorPrice;

  // Cash gate: standard LTV loan, max CPF applied to the non-cash portion.
  const ltvCap = getLtvCap(params.age, params.tenureYears, params.propertyCount, params.ltvRules);
  const loan = Math.round(price * ltvCap);
  const downPayment = price - loan;
  const cashMinimum = price * 0.05; // ≥5% of price must be cash
  const cpfUsed = Math.min(params.availableCpf, Math.max(0, downPayment - cashMinimum));
  const cashDown = downPayment - cpfUsed;
  const bsd = calculateBsd(price, params.bsdSlabs);
  const absd = calculateAbsd(price, params.residency, params.propertyCount, params.absdMatrix);
  const legal = estimateLegalFees(price);
  const minCashTxn = Math.round(cashDown + bsd + absd + legal);
  const emergency = Math.round(params.annualIncome * EMERGENCY_FUND_RATIO);

  // Income gate: minimum income to service that loan at the MAS TDSR cap.
  const minAnnualIncome = minIncomeForLoan(
    loan,
    params.existingMonthlyDebt,
    params.tdsr,
    params.tenureYears,
    params.tdsr.cap
  );
  const minMonthlyIncome = Math.round(minAnnualIncome / 12);
  const monthlyIncome = Math.round(params.annualIncome / 12);

  return {
    floor_price: price,
    floor_as_of: PRIVATE_FLOOR.as_of,
    ltv_cap: ltvCap,
    loan_amount: loan,
    down_payment_cash: Math.round(cashDown),
    down_payment_cpf: Math.round(cpfUsed),
    bsd: Math.round(bsd),
    absd: Math.round(absd),
    legal_fees_est: legal,
    min_cash_transaction: minCashTxn,
    emergency_fund: emergency,
    min_monthly_income: minMonthlyIncome,
    available_cash: params.availableCash,
    cash_gap: Math.round(minCashTxn - params.availableCash),
    cash_ok: params.availableCash >= minCashTxn,
    monthly_income: monthlyIncome,
    income_gap: minMonthlyIncome - monthlyIncome,
    income_ok: monthlyIncome >= minMonthlyIncome,
  };
}
