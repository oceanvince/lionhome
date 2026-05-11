export type ResidencyOption = "sc" | "pr" | "foreigner_wp" | "foreigner_none";
export type PropertyPurpose = "self" | "invest" | "upgrade";
export type PropertyTypePref = "new_launch" | "resale" | "either";
export type Timeline = "3m" | "6m" | "1y" | "explore";
export type LoanTenure = 20 | 25 | 30;

export interface CalculatorFormState {
  // Step 1
  residency: ResidencyOption | null;
  age: number;
  existingProperties: 0 | 1 | 2; // 2 = "2+"

  // Step 2
  incomeBucket: number;  // 0-7 index into INCOME_BUCKETS
  cashBucket: number;    // 0-4
  cpfBucket: number;     // 0-4
  debtBucket: number;    // 0-4

  // Step 3
  purpose: PropertyPurpose | null;
  propertyType: PropertyTypePref | null;
  timeline: Timeline | null;
  tenure: LoanTenure;
}

export const INITIAL_FORM: CalculatorFormState = {
  residency: null,
  age: 35,
  existingProperties: 0,
  incomeBucket: 3,
  cashBucket: 1,
  cpfBucket: 1,
  debtBucket: 0,
  purpose: null,
  propertyType: null,
  timeline: null,
  tenure: 25,
};
