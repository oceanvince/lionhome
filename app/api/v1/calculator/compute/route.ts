import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { SEED_TAX_RATES } from "@/lib/tax";
import type { TaxRatesConfig } from "@/lib/tax";
import { computeV2 } from "@/lib/calculator/v2-compute";
import { readTrackingHeaders, trackEvent } from "@/lib/analytics/events";
import { clientKey, rateLimit } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";

const DEFAULT_DISPLAY_RATE = 0.0165; // Default market rate shown to user

/** `calculator_runs.session_id` is a uuid column; anything else is dropped. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // Browser-minted id grouping every run in one sitting. Accepted as a plain
  // string, NOT as z.string().uuid(): this is an analytics field, and rejecting
  // a malformed one here would fail the whole calculation. `crypto.randomUUID`
  // is undefined in any non-secure context, so a strict schema would take the
  // core feature down on plain-http previews and older browsers alike. Shape is
  // checked at the point of use instead, where a bad value degrades to "no
  // session id" and the column falls back to its own default.
  session_id: z.string().optional(),
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
 * Persist the run the moment it is computed, rather than when the visitor
 * presses 找顾问.
 *
 * Before this, a report only reached the database if the visitor both ticked
 * the PDPA box and pressed the CTA. On 2026-07-13 that was 1 of 11 computations;
 * the other 10 were unrecoverable, because Vercel runtime logs never carry
 * response bodies — only metadata and whatever the function prints itself.
 *
 * Deliberately synchronous: the response hands `run_id` back to the client, and
 * a run the client cannot reference is a lead that cannot be linked later. One
 * insert behind the loading animation is not perceptible. A failure is
 * swallowed — the visitor still gets their result, and the client falls back to
 * posting the full payload to /save.
 */
async function persistRun(
  inputs: Record<string, unknown>,
  outputs: unknown,
  taxRatesVersion: string,
  sessionId: string | undefined
): Promise<string | null> {
  try {
    // DB types are stubs pending `npm run db:types:remote`. Cast via `any`,
    // matching /api/v1/calculator/save.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getSupabaseServiceRoleClient() as any;
    const { data, error } = await db
      .from("calculator_runs")
      .insert({
        user_id: null,
        ...(sessionId && UUID_RE.test(sessionId) ? { session_id: sessionId } : {}),
        inputs,
        outputs,
        tax_rates_version: taxRatesVersion,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[/api/v1/calculator/compute] Run insert failed:", error.message);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.error("[/api/v1/calculator/compute] Run insert threw:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Every call now writes a row holding a full financial profile, so an
  // unthrottled loop here is both a data-volume and a PII problem. Generous
  // enough that re-running the questionnaire never trips it.
  const limit = rateLimit(clientKey(req.headers, "compute"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "操作过于频繁，请稍后再试",
          retryAfter: limit.retryAfter,
        },
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  // Tracked server-side rather than in the browser: this is the conversion that
  // matters, and an ad blocker must not be able to hide it. `after()` keeps the
  // insert off the response path.
  const tracking = readTrackingHeaders(req.headers);

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
    after(() =>
      trackEvent({
        ...tracking,
        name: "calculator_submit_failed",
        path: "/calculator",
        props: { reason: "INVALID_INPUT", fields: fields.map((f) => f.field) },
      })
    );
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

    // Crawlers that POST here would otherwise fill the table with PII-shaped
    // rows and inflate every figure derived from it, so they compute but do not
    // persist. `session_id` lives in its own column; keep it out of `inputs`.
    const { session_id: sessionId, ...storedInputs } = input;
    const runId = tracking.isBot
      ? null
      : await persistRun(storedInputs, data, taxRatesVersion, sessionId);

    after(() =>
      trackEvent({
        ...tracking,
        name: "calculator_submit",
        path: "/calculator",
        // Enum fields only — no income, no cash, nothing identifying.
        props: {
          residency: input.residency,
          timeline: input.timeline ?? null,
          existing_properties: input.existing_properties,
          run_id: runId,
        },
      })
    );
    // `run_id` sits beside `data` rather than inside it: it describes the stored
    // row, not the computation, and `data` is echoed back verbatim as `outputs`.
    return NextResponse.json({ ok: true, data, run_id: runId });
  } catch (err) {
    console.error("[/api/v1/calculator/compute] Engine error:", err);
    after(() =>
      trackEvent({
        ...tracking,
        name: "calculator_submit_failed",
        path: "/calculator",
        props: { reason: "CALC_INTERNAL_ERROR" },
      })
    );
    return NextResponse.json({
      ok: false,
      error: { code: "CALC_INTERNAL_ERROR", message: "计算引擎出现意外错误，请重试" },
    });
  }
}
