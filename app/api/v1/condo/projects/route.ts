import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listCards } from "@/lib/condo/search";

export const runtime = "nodejs";

const QuerySchema = z.object({
  district: z.string().max(10).optional(),
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

  const db = await getSupabaseServerClient();
  const cards = await listCards(db, parsed.data);

  return NextResponse.json({ ok: true, data: { cards, count: cards.length } });
}
