import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveTaxRates } from "@/lib/tax/active-rates";
import { getActiveProjectBySlug } from "@/lib/condo/repo";
import { computeFit } from "@/lib/condo/fit";

export const runtime = "nodejs";

const FitSchema = z.object({
  slug: z.string().min(1),
  calc: z.object({
    residency: z.enum(["citizen", "pr", "foreigner", "company"]),
    existing_properties: z.number().int().min(0).max(10),
    annual_income: z.number().positive(),
    age: z.number().int().min(21).max(80),
    available_cash: z.number().min(0),
    available_cpf: z.number().min(0),
    loan_tenure_years: z.number().int().min(5).max(30).default(30),
    existing_monthly_debt: z.number().min(0).default(0),
    display_rate: z.number().min(0.005).max(0.06).default(0.0165),
  }),
});

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

  const parsed = FitSchema.safeParse(body);
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

  const { slug, calc } = parsed.data;
  const db = await getSupabaseServerClient();

  // The repo throws on a DB error rather than reporting it as "no such project",
  // so the outage gets its own code instead of hiding behind PROJECT_NOT_FOUND.
  let project;
  try {
    project = await getActiveProjectBySlug(db, slug);
  } catch (err) {
    console.error("[/api/v1/condo/fit] project lookup failed:", err);
    return NextResponse.json(
      { ok: false, error: { code: "FIT_INTERNAL_ERROR", message: "服务暂时不可用，请稍后再试" } },
      { status: 500 }
    );
  }
  if (!project) {
    return NextResponse.json({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND", message: "未找到该楼盘或尚未发布" },
    });
  }

  const { rates } = await loadActiveTaxRates(db);

  const fit = computeFit({
    psfMin: project.psfMin,
    taxRates: rates,
    calc: {
      residency: calc.residency,
      existingProperties: calc.existing_properties,
      annualIncome: calc.annual_income,
      age: calc.age,
      availableCash: calc.available_cash,
      availableCpf: calc.available_cpf,
      loanTenureYears: calc.loan_tenure_years,
      existingMonthlyDebt: calc.existing_monthly_debt,
      displayRate: calc.display_rate,
    },
  });

  if (!fit) {
    return NextResponse.json({
      ok: false,
      error: { code: "PSF_UNAVAILABLE", message: "该楼盘暂无成交 PSF，无法估算适配度" },
    });
  }

  return NextResponse.json({ ok: true, data: { slug, ...fit } });
}
