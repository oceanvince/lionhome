export type Residency = "citizen" | "pr" | "foreigner" | "company";

export interface BsdSlab {
  /** Inclusive lower bound in SGD. First slab starts at 0. */
  threshold_sgd: number;
  /** Marginal rate as a decimal (e.g., 0.01 for 1%). */
  rate: number;
}

export interface AbsdMatrixEntry {
  residency: Residency;
  /** Property count for which this rate applies (1, 2, or 3 = 3+). */
  property_count: 1 | 2 | 3;
  rate: number;
}

export interface LtvRule {
  scenario: string;
  ltv_cap: number;
}

export interface TdsrConfig {
  cap: number;
  stress_rate: number;
}

export interface MsrConfig {
  cap: number;
}

export interface TaxRatesConfig {
  effective_from: string;
  bsd_slabs: BsdSlab[];
  absd_matrix: AbsdMatrixEntry[];
  ltv_rules: LtvRule[];
  tdsr: TdsrConfig;
  msr: MsrConfig;
}
