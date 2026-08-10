import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { SEED_TAX_RATES } from "@/lib/tax";
import type { TaxRatesConfig } from "@/lib/tax";
import { computeV2 } from "@/lib/calculator/v2-compute";

export const runtime = "nodejs";

const DEFAULT_DISPLAY_RATE = 0.0165; // Default market rate shown to user

const ComputeSchema = z.object({
  residency: z.enum(["citizen", "pr", "foreigner", "company"]),
  existing_properties: z.number().int().min(0).max(10),
  annual_income: z.number().positive(),
  age: z.number().int().min(21).max(80),
  available_cash: z.number().min(0),
  available_cpf: z.number().min(0), // foreigners send 0
  // V2: these now carry defaults so the trimmed questionnaire can omit them
  loan_tenure_years: z.number().int().min(5).max(30).default(30),
  existing_monthly_debt: z.number().min(0).default(0),
  holding_years: z.number().int().min(1).max(30).default(7),
  display_rate: z.number().min(0.005).max(0.06).default(DEFAULT_DISPLAY_RATE),
  // Lead label — not used in calculation
  timeline: z.enum(["6m", "1y", "explore"]).optional(),
  // Anonymous run persistence — links this compute to a later lead claim.
  session_id: z.string().uuid().optional(),
  // Optional legacy fields — accepted but unused
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

/**
 * Persist an anonymous run (user_id null) so we can see how the tool is actually
 * used, not just the sliver of users who go on to contact an advisor.
 *
 * `inputs` deliberately excludes session_id and the unused legacy fields: this row
 * carries budget figures but nothing that identifies a person. Association with a
 * name/phone happens later, and only on explicit consent, via
 * /api/v1/calculator/save claiming this run_id.
 */
async function insertAnonymousRun(
  input: ComputeInput,
  outputs: unknown,
  taxRatesVersion: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseServiceRoleClient();
    const { session_id, ...inputsToStore } = input;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("calculator_runs") as any)
      .insert({
        user_id: null,
        ...(session_id ? { session_id } : {}),
        inputs: inputsToStore,
        outputs,
        tax_rates_version: taxRatesVersion,
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
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
    const data = computeV2({
      solveParams: {
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
        displayRate: input.display_rate,
      },
      isFirstProperty: input.existing_properties === 0,
      holdingYears: input.holding_years,
      rate: input.display_rate,
      taxRatesVersion,
    });

    // Persist anonymously. A DB failure must never break the calculation the user
    // is waiting on, so a null run_id is an acceptable outcome here.
    const runId = await insertAnonymousRun(input, data, taxRatesVersion);

    return NextResponse.json({ ok: true, data, run_id: runId });
  } catch (err) {
    console.error("[/api/v1/calculator/compute] Engine error:", err);
    return NextResponse.json({
      ok: false,
      error: { code: "CALC_INTERNAL_ERROR", message: "计算引擎出现意外错误，请重试" },
    });
  }
}
