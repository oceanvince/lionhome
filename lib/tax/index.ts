export * from "./types";
export { calculateBsd } from "./bsd";
export { calculateAbsd, getAbsdRate } from "./absd";
export {
  solveMaxPurchasePrice,
  solveByMonthlyRatio,
  computeTiers,
  isFeasibleAtPrice,
  buildOutput,
  COMFORT_RATIO,
  BALANCED_RATIO,
  estimateLegalFees,
} from "./tdsr";
export type {
  CalcOutputs,
  ScenarioRow,
  SolveParams,
  PriceTier,
  PriceTierKey,
  TiersResult,
} from "./tdsr";
export { SEED_TAX_RATES } from "./seed";
export {
  computeViability,
  MIN_VIABLE_PRICE,
  MIN_VIABLE_PRICE_ENABLED,
  MIN_DOWN_PAYMENT,
} from "./viability";
export type { Viability } from "./viability";
