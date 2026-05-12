import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { solveMaxPurchasePrice, SEED_TAX_RATES } from "@/lib/tax";
import type { TaxRatesConfig } from "@/lib/tax";

export const runtime = "nodejs";

const DISPLAY_RATE = 0.0165; // Default market rate shown to user

const ComputeSchema = z.object({
  residency: z.enum(["citizen", "pr", "foreigner", "company"]),
  existing_properties: z.number().int().min(0).max(10),
  annual_income: z.number().positive(),
  age: z.number().int().min(18).max(80),
  existing_monthly_debt: z.number().min(0),
  available_cash: z.number().min(0),
  available_cpf: z.number().min(0),
  loan_tenure_years: z.number().int().min(5).max(30),
  // Optional fields — not used in core calc but stored with result
  marital_status: z.enum(["single", "married", "married_foreign_spouse"]).optional(),
  spouse_residency: z.enum(["citizen", "pr", "foreigner"]).optional(),
  employment_type: z.enum(["salaried", "self_employed", "commission"]).optional(),
  property_type_pref: z.enum(["new_launch", "resale", "either"]).optional(),
});

type ComputeInput = z.infer<typeof ComputeSchema>;

async function fetchActiveTaxRates(): Promise<TaxRatesConfig | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("tax_rates")
      .select("effective_from, bsd_slabs, absd_matrix, ltv_rules, tdsr, msr")
      .is("effective_to", null)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as TaxRatesConfig;
  } catch {
    return null;
  }
}

async function insertSeedRates(): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("tax_rates") as any).insert({
      version: `seed-${SEED_TAX_RATES.effective_from}`,
      effective_from: SEED_TAX_RATES.effective_from,
      effective_to: null,
      bsd_slabs: SEED_TAX_RATES.bsd_slabs,
      absd_matrix: SEED_TAX_RATES.absd_matrix,
      ltv_rules: SEED_TAX_RATES.ltv_rules,
      tdsr: SEED_TAX_RATES.tdsr,
      msr: SEED_TAX_RATES.msr,
      notes: "Auto-inserted seed rates (fallback)",
    });
    return !error;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({
      ok: false,
      error: { code: "INVALID_INPUT", message: "请求体必须是合法的 JSON" },
    });
  }

  const parsed = ComputeSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return NextResponse.json({
      ok: false,
      error: { code: "INVALID_INPUT", message: "参数校验失败", fields },
    });
  }

  const input: ComputeInput = parsed.data;

  // Fetch active tax rates
  let taxRates = await fetchActiveTaxRates();
  let taxRatesVersion: string;

  if (!taxRates) {
    // Fire-and-forget seed insert
    insertSeedRates().catch(() => {});
    // Use seed rates in-memory for this request to avoid user wait
    taxRates = SEED_TAX_RATES;
    taxRatesVersion = `seed-${SEED_TAX_RATES.effective_from}`;
  } else {
    taxRatesVersion =
      (taxRates as TaxRatesConfig & { version?: string }).version ??
      `db-${taxRates.effective_from}`;
  }

  try {
    const outputs = solveMaxPurchasePrice({
      annualIncome: input.annual_income,
      existingMonthlyDebt: input.existing_monthly_debt,
      availableCash: input.available_cash,
      availableCpf: input.available_cpf,
      age: input.age,
      tenureYears: input.loan_tenure_years,
      propertyCount: Math.min(input.existing_properties + 1, 3), // buying = current + 1
      residency: input.residency,
      bsdSlabs: taxRates.bsd_slabs,
      absdMatrix: taxRates.absd_matrix,
      ltvRules: taxRates.ltv_rules,
      tdsr: taxRates.tdsr,
      displayRate: DISPLAY_RATE,
    });

    return NextResponse.json({
      ok: true,
      data: { outputs, tax_rates_version: taxRatesVersion },
    });
  } catch (err) {
    console.error("[/api/v1/calculator/compute] Engine error:", err);
    return NextResponse.json({
      ok: false,
      error: { code: "CALC_INTERNAL_ERROR", message: "计算引擎出现意外错误，请重试" },
    });
  }
}
