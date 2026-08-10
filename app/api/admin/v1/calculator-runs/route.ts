import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rows scanned per request. Keeps the aggregation bounded on a growing table. */
const MAX_ROWS = 5000;

type Bucket = { label: string; count: number };

/** Bucket edges in SGD. Last bucket is open-ended. */
const MONTHLY_INCOME_EDGES = [5000, 8000, 12000, 20000, 30000];
const CASH_EDGES = [100_000, 200_000, 350_000, 500_000, 1_000_000];
const BUDGET_EDGES = [800_000, 1_200_000, 1_800_000, 2_500_000, 4_000_000];

function bucketize(values: number[], edges: number[], fmt: (n: number) => string): Bucket[] {
  const counts: number[] = new Array(edges.length + 1).fill(0);
  for (const v of values) {
    let i = 0;
    while (i < edges.length && v >= (edges[i] as number)) i++;
    counts[i] = (counts[i] ?? 0) + 1;
  }
  const first = edges[0] as number;
  const last = edges[edges.length - 1] as number;
  return counts.map((count, i) => ({
    label:
      i === 0
        ? `< ${fmt(first)}`
        : i === edges.length
          ? `≥ ${fmt(last)}`
          : `${fmt(edges[i - 1] as number)} – ${fmt(edges[i] as number)}`,
    count,
  }));
}

const sgd = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1000}k`);

function tally(values: (string | null | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) {
    const key = v ?? "unknown";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0
    ? Math.round(((s[mid - 1] as number) + (s[mid] as number)) / 2)
    : (s[mid] as number);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_CONFIGURED", message: "ADMIN_API_SECRET is not set" } },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing bearer token" } },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30), 1), 365);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = getSupabaseServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("calculator_runs") as any)
    .select("id, user_id, inputs, outputs, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error("[/api/admin/v1/calculator-runs] Query failed:", error);
    return NextResponse.json(
      { ok: false, error: { code: "DB_ERROR", message: "查询失败" } },
      { status: 500 }
    );
  }

  type Row = {
    id: string;
    user_id: string | null;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    created_at: string;
  };
  const rows = (data ?? []) as Row[];

  const annualIncomes = rows
    .map((r) => num(r.inputs?.annual_income))
    .filter((n): n is number => n !== null);
  const monthlyIncomes = annualIncomes.map((n) => Math.round(n / 12));
  const cash = rows
    .map((r) => num(r.inputs?.available_cash))
    .filter((n): n is number => n !== null);
  const cpf = rows.map((r) => num(r.inputs?.available_cpf)).filter((n): n is number => n !== null);
  const ages = rows.map((r) => num(r.inputs?.age)).filter((n): n is number => n !== null);

  // Balanced tier midpoint is the headline number the user actually sees.
  const budgets = rows
    .map((r) => {
      const tiers = r.outputs?.tiers as Record<string, { midpoint?: unknown }> | undefined;
      return num(tiers?.balanced?.midpoint);
    })
    .filter((n): n is number => n !== null);

  // Daily volume, oldest-first for charting.
  const byDay: Record<string, number> = {};
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  const claimed = rows.filter((r) => r.user_id !== null).length;

  return NextResponse.json({
    ok: true,
    data: {
      window_days: days,
      total_runs: rows.length,
      truncated: rows.length === MAX_ROWS,
      // How many went on to be linked to a person — the real funnel end.
      claimed_runs: claimed,
      claim_rate: rows.length ? Number((claimed / rows.length).toFixed(3)) : null,
      medians: {
        monthly_income: median(monthlyIncomes),
        available_cash: median(cash),
        available_cpf: median(cpf),
        age: median(ages),
        budget_midpoint: median(budgets),
      },
      distributions: {
        residency: tally(rows.map((r) => r.inputs?.residency as string | undefined)),
        timeline: tally(rows.map((r) => r.inputs?.timeline as string | undefined)),
        existing_properties: tally(
          rows.map((r) => {
            const n = num(r.inputs?.existing_properties);
            return n === null ? undefined : String(n);
          })
        ),
        monthly_income: bucketize(monthlyIncomes, MONTHLY_INCOME_EDGES, sgd),
        available_cash: bucketize(cash, CASH_EDGES, sgd),
        budget_midpoint: bucketize(budgets, BUDGET_EDGES, sgd),
      },
      runs_by_day: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
    },
  });
}
