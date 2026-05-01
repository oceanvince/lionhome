import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stage 0 smoke endpoint: proves Vercel ↔ Supabase wiring.
 *
 * Reads the active row from `tax_rates` via the anon-keyed server client.
 * RLS allows anon SELECT on rows where `effective_to is null` — see
 * supabase/migrations/20260430000004_rls_policies.sql.
 *
 * If this returns `{ status: "ok", dbReachable: true, taxRatesVersion: ... }`
 * from a deployed Vercel URL, the entire infra path is wired correctly.
 */
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    // The explicit `<{ version: string }>` is a workaround until
    // `npm run db:types:remote` replaces the stubbed Database type
    // with one generated from the live schema. After that, drop the generic.
    const { data, error } = await supabase
      .from("tax_rates")
      .select("version")
      .is("effective_to", null)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle<{ version: string }>();

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          dbReachable: false,
          message: error.message,
          code: error.code,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      dbReachable: true,
      taxRatesVersion: data?.version ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ status: "error", dbReachable: false, message }, { status: 500 });
  }
}
