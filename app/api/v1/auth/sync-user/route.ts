import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SyncSchema = z.object({
  session_id: z.string().uuid().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

// DB types are stubs pending `npm run db:types:remote`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: ReturnType<typeof getSupabaseServiceRoleClient>): any {
  return client;
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = SyncSchema.safeParse(body);
  const opts = parsed.success ? parsed.data : {};

  const serviceClient = getSupabaseServiceRoleClient();

  const { data: userRow, error: upsertErr } = await db(serviceClient)
    .from("users")
    .upsert(
      {
        auth_user_id: user.id,
        phone: user.phone ?? null,
        email: user.email ?? null,
        last_seen_at: new Date().toISOString(),
        utm_source: opts.utm_source ?? null,
        utm_medium: opts.utm_medium ?? null,
        utm_campaign: opts.utm_campaign ?? null,
      },
      { onConflict: "auth_user_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (upsertErr || !userRow) {
    console.error("[/api/v1/auth/sync-user] Upsert failed:", upsertErr);
    return NextResponse.json({
      ok: false,
      error: { code: "DB_ERROR", message: "用户同步失败，请重试" },
    });
  }

  const internalUserId = (userRow as { id: string }).id;

  if (opts.session_id) {
    await db(serviceClient)
      .from("calculator_runs")
      .update({ user_id: internalUserId })
      .eq("session_id", opts.session_id)
      .is("user_id", null);

    await db(serviceClient)
      .from("quiz_runs")
      .update({ user_id: internalUserId })
      .eq("session_id", opts.session_id)
      .is("user_id", null);
  }

  return NextResponse.json({ ok: true, data: { user_id: internalUserId } });
}
