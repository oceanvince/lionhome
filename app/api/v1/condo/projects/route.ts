import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listCards, computeFallback } from "@/lib/condo/search";
import { countActiveProjects } from "@/lib/condo/repo";

export const runtime = "nodejs";

const QuerySchema = z.object({
  // Normalize + validate the district to "D<digits>" (in-bound ACL, §12-⑥).
  district: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^D\d{1,2}$/)
    .optional(),
  sort: z.enum(["profit", "psf_asc", "top_desc"]).default("profit"),
  limit: z.coerce.number().int().min(1).max(60).default(30),
});

/** Search-results list (SPEC §3.2). GET /api/v1/condo/projects?district=&sort= */
export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    district: req.nextUrl.searchParams.get("district") ?? undefined,
    sort: req.nextUrl.searchParams.get("sort") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });
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

  try {
    const db = await getSupabaseServerClient();
    const [cards, activeCount] = await Promise.all([
      listCards(db, parsed.data),
      countActiveProjects(db),
    ]);
    const fallback = computeFallback({
      activeCount,
      resultCount: cards.length,
      filtered: Boolean(parsed.data.district),
    });
    return NextResponse.json({ ok: true, data: { cards, count: cards.length, fallback } });
  } catch (err) {
    console.error("[/api/v1/condo/projects]", err);
    return NextResponse.json({
      ok: false,
      error: { code: "SEARCH_INTERNAL_ERROR", message: "搜索暂不可用，请重试" },
    });
  }
}
