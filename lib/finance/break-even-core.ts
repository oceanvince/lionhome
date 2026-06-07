/**
 * Buy-vs-rent break-even engine — PURE, shared by client and server.
 *
 * Goal: find g* (annual home appreciation) such that, after `holdingYears`,
 * the buyer's net worth equals the renter's net worth.
 *
 * Model (symmetric net-worth framework):
 *   Both parties commit the same monthly housing budget = the owner's outflow.
 *   - Buyer terminal wealth = home equity at sale
 *        = price·(1+g)^H·(1 − sellingCost) − remainingLoan
 *     Mortgage interest is captured via slow principal paydown (remainingLoan);
 *     carrying costs are captured on the renter side below.
 *   - Renter terminal wealth = upfront cash invested + monthly surplus invested
 *        = upfrontCash·(1+r)^H + (ownerOutflow − rent)·annuity(r, H)
 *     The renter avoids the owner's carrying costs (mcst/tax/maintenance) and
 *     rent, investing the difference at r_alt.
 *
 * NOTE — deviates from TD §4.3 on purpose: the TD's literal formula subtracts
 * totalInterest AND remainingLoan on the buy side, and subtracts totalRent while
 * monthlySaving already nets out rent — i.e. it double-counts both interest and
 * rent. This symmetric model expresses the same intent without double counting.
 *
 * CPF is treated as fungible equity on the buy side; the renter only re-invests
 * the *cash* portion of upfront cost (upfrontCash excludes CPF). MVP simplification.
 */

export interface BreakEvenAssumptions {
  /** Alternative investment return for the renter (nominal, annual). */
  rAlt: number;
  /** Monthly maintenance / management fee (MCST). */
  mcstMonthly: number;
  /** Annual property tax as a fraction of price. */
  propTaxRate: number;
  /** Annual maintenance / depreciation as a fraction of price. */
  maintRate: number;
  /** Transaction cost on sale (agent + legal; SSD = 0 for holding ≥ 4y). */
  sellingCost: number;
}

export const DEFAULT_BE_ASSUMPTIONS: BreakEvenAssumptions = {
  rAlt: 0.05,
  mcstMonthly: 450,
  propTaxRate: 0.004,
  maintRate: 0.01,
  sellingCost: 0.02,
};

export interface BreakEvenInput {
  price: number;
  /** Mortgage principal (already TDSR/LTV-limited). */
  loanAmount: number;
  /** Cash the renter would invest instead: down-payment cash + BSD + ABSD + fees (excludes CPF). */
  upfrontCash: number;
  monthlyRent: number;
  holdingYears: number;
  tenureYears: number;
  /** Mortgage rate shown to the user (not the stress rate). */
  rate: number;
  assumptions?: Partial<BreakEvenAssumptions>;
}

export interface BreakEvenResult {
  /** Break-even annual appreciation. */
  g_star: number;
  monthly_mortgage: number;
  buyer_monthly_outflow: number;
  /** Owner outflow − rent; may be negative when rent exceeds owning cost. */
  monthly_saving: number;
  /** Set when g* hits a search bound: "below" = wins even falling, "above" = loses even at +15%. */
  clamped: "below" | "above" | null;
}

const G_LO = -0.1;
const G_HI = 0.15;

function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  if (annualRate === 0) return principal / (years * 12);
  const i = annualRate / 12;
  const N = years * 12;
  return (principal * i * Math.pow(1 + i, N)) / (Math.pow(1 + i, N) - 1);
}

/** Remaining loan balance after `holdingYears` of a `tenureYears` amortising loan. */
function remainingBalance(
  loan: number,
  annualRate: number,
  tenureYears: number,
  holdingYears: number
): number {
  if (loan <= 0) return 0;
  const monthly = monthlyPayment(loan, annualRate, tenureYears);
  const n = Math.min(holdingYears, tenureYears) * 12;
  if (annualRate === 0) return Math.max(0, loan - monthly * n);
  const i = annualRate / 12;
  const bal = loan * Math.pow(1 + i, n) - monthly * ((Math.pow(1 + i, n) - 1) / i);
  return Math.max(0, bal);
}

/** Future value of $1/month contributed for `years`, compounded monthly at `annualRate`. */
function monthlyAnnuityFactor(annualRate: number, years: number): number {
  const n = years * 12;
  if (annualRate === 0) return n;
  const r = annualRate / 12;
  return (Math.pow(1 + r, n) - 1) / r;
}

export function computeBreakEven(input: BreakEvenInput): BreakEvenResult {
  const a = { ...DEFAULT_BE_ASSUMPTIONS, ...input.assumptions };
  const { price, loanAmount, upfrontCash, monthlyRent, holdingYears, tenureYears, rate } = input;

  const monthly = monthlyPayment(loanAmount, rate, tenureYears);
  const ownerOutflow =
    monthly + a.mcstMonthly + (price * a.propTaxRate) / 12 + (price * a.maintRate) / 12;
  const monthlySaving = ownerOutflow - monthlyRent;

  const remaining = remainingBalance(loanAmount, rate, tenureYears, holdingYears);
  const annuity = monthlyAnnuityFactor(a.rAlt, holdingYears);
  const rentNet = upfrontCash * Math.pow(1 + a.rAlt, holdingYears) + monthlySaving * annuity;

  const buyNet = (g: number): number =>
    price * Math.pow(1 + g, holdingYears) * (1 - a.sellingCost) - remaining;

  const base = {
    monthly_mortgage: Math.round(monthly),
    buyer_monthly_outflow: Math.round(ownerOutflow),
    monthly_saving: Math.round(monthlySaving),
  };

  // buyNet is strictly increasing in g; rentNet is constant → unique root.
  if (buyNet(G_LO) >= rentNet) return { g_star: G_LO, clamped: "below", ...base };
  if (buyNet(G_HI) <= rentNet) return { g_star: G_HI, clamped: "above", ...base };

  let lo = G_LO;
  let hi = G_HI;
  for (let i = 0; i < 80; i++) {
    const g = (lo + hi) / 2;
    if (buyNet(g) < rentNet) lo = g;
    else hi = g;
    if (hi - lo < 1e-6) break;
  }
  return { g_star: (lo + hi) / 2, clamped: null, ...base };
}

/* Type-only import to map a tax-engine output into break-even input.
   Keeping this adapter here (not in a server file) guarantees client and
   server feed the engine identical numbers — real §7.3 consistency. */
import type { CalcOutputs } from "@/lib/tax";

export interface BreakEvenOptions {
  monthlyRent: number;
  holdingYears: number;
  tenureYears: number;
  rate: number;
  assumptions?: Partial<BreakEvenAssumptions>;
}

export function breakEvenFromCalcOutputs(
  output: CalcOutputs,
  opts: BreakEvenOptions
): BreakEvenResult {
  // legal_fees_est already includes the $500 mortgage stamp (see buildOutput).
  const upfrontCash = output.down_payment.cash + output.bsd + output.absd + output.legal_fees_est;
  return computeBreakEven({
    price: output.max_price,
    loanAmount: output.loan_amount,
    upfrontCash,
    monthlyRent: opts.monthlyRent,
    holdingYears: opts.holdingYears,
    tenureYears: opts.tenureYears,
    rate: opts.rate,
    assumptions: opts.assumptions,
  });
}
