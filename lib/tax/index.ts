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
  EMERGENCY_FUND_RATIO,
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
export { computeMarketFloor, PRIVATE_FLOOR } from "./floor";
export type { MarketFloor } from "./floor";
