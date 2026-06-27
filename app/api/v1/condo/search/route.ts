import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { searchActiveProjects } from "@/lib/condo/repo";

export const runtime = "nodejs";

// In-bound ACL: cap the term so a giant query can't be pushed into SQL (§12-⑥).
const QuerySchema = z.object({ q: z.string().trim().max(80).default("") });

/** Autocomplete over active projects (SPEC §3.1). GET /api/v1/condo/search?q= */
export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({ q: req.nextUrl.searchParams.get("q") ?? undefined });
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
  const q = parsed.data.q;
  if (q.length < 1) {
    return NextResponse.json({ ok: true, data: { query: q, results: [] } });
  }

  try {
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
  } catch (err) {
    console.error("[/api/v1/condo/search]", err);
    return NextResponse.json({
      ok: false,
      error: { code: "SEARCH_INTERNAL_ERROR", message: "搜索暂不可用，请重试" },
    });
  }
}
