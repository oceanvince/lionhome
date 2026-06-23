import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { searchActiveProjects } from "@/lib/condo/repo";

export const runtime = "nodejs";

/** Autocomplete over active projects (SPEC §3.1). GET /api/v1/condo/search?q= */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ ok: true, data: { query: q, results: [] } });
  }

  const db = await getSupabaseServerClient();
  const projects = await searchActiveProjects(db, q, 8);

  const results = projects.map((p) => ({
    slug: p.slug,
    name: p.name,
    district: p.district,
    tenure: p.tenure,
    psfMin: p.psfMin,
    psfMax: p.psfMax,
  }));

  return NextResponse.json({ ok: true, data: { query: q, results } });
}
