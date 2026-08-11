import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";

const Layer1Schema = z.object({
  name: z.string().min(1),
  phone: z.string().regex(/^\+\d{7,15}$/, "手机号须为 E.164 格式，如 +6591234567"),
});

const SaveSchema = z.object({
  inputs: z.record(z.unknown()),
  outputs: z.record(z.unknown()),
  tax_rates_version: z.string(),
  session_id: z.string().uuid(),
  run_id: z.string().uuid().optional(),
  layer1: Layer1Schema.optional(),
});

// DB types are stubs pending `npm run db:types:remote`. Cast via `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: ReturnType<typeof getSupabaseServiceRoleClient>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

export async function POST(req: NextRequest) {
  // Unauthenticated and it can insert a run and create a user row, so it needs
  // the same ceiling as /compute. A visitor hits it once per report.
  const limit = rateLimit(clientKey(req.headers, "save"), { limit: 20, windowMs: 60_000 });
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({
      ok: false,
      error: { code: "INVALID_INPUT", message: "请求体必须是合法的 JSON" },
    });
  }

  const parsed = SaveSchema.safeParse(body);
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

  const { inputs, outputs, tax_rates_version, session_id, run_id, layer1 } = parsed.data;

  const anonClient = await getSupabaseServerClient();
  const {
    data: { user },
  } = await anonClient.auth.getUser();

  const serviceClient = getSupabaseServiceRoleClient();

  let userId: string | null = null;

  if (user) {
    const { data: userRow } = await db(serviceClient)
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    userId = (userRow as { id: string } | null)?.id ?? null;
  } else if (layer1) {
    const phone = layer1.phone;
    const { data: existingUser } = await db(serviceClient)
      .from("users")
      .select("id")
      .eq("phone", phone)
      .is("auth_user_id", null)
      .maybeSingle();

    if (existingUser) {
      await db(serviceClient)
        .from("users")
        .update({ display_name: layer1.name, updated_at: new Date().toISOString() })
        .eq("id", (existingUser as { id: string }).id);
      userId = (existingUser as { id: string }).id;
    } else {
      const { data: newUser, error: insertErr } = await db(serviceClient)
        .from("users")
        .insert({ phone, display_name: layer1.name })
        .select("id")
        .single();
      if (insertErr || !newUser) {
        console.error("[/api/v1/calculator/save] User insert failed:", insertErr);
        return NextResponse.json({
          ok: false,
          error: { code: "DB_ERROR", message: "无法创建用户记录" },
        });
      }
      userId = (newUser as { id: string }).id;
    }
  }

  // The run normally already exists — /compute persists it before returning —
  // so this links it to the resolved user. If the row is missing (a compute-time
  // insert that failed, or a stale id from a cached tab) fall through to the
  // insert below: returning an id that references nothing would lose the report
  // exactly the way it was lost before runs were persisted at compute time.
  if (run_id) {
    // Only ever attach a user, never detach one. This endpoint is unauthenticated
    // and the same run_id can arrive again from a retry, a second tab, or a
    // replay; writing `user_id: null` on those would unlink a run that an earlier
    // request with layer1 had already tied to a lead.
    const { data: existing } = userId
      ? await db(serviceClient)
          .from("calculator_runs")
          .update({ user_id: userId })
          .eq("id", run_id)
          .select("id")
          .maybeSingle()
      : await db(serviceClient).from("calculator_runs").select("id").eq("id", run_id).maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, data: { run_id } });
    }
    console.warn("[/api/v1/calculator/save] run_id not found, inserting instead:", run_id);
  }

  const { data: run, error: runErr } = await db(serviceClient)
    .from("calculator_runs")
    .insert({ user_id: userId, session_id, inputs, outputs, tax_rates_version })
    .select("id")
    .single();

  if (runErr || !run) {
    console.error("[/api/v1/calculator/save] Run insert failed:", runErr);
    return NextResponse.json({
      ok: false,
      error: { code: "DB_ERROR", message: "无法保存测算结果" },
    });
  }

  return NextResponse.json({ ok: true, data: { run_id: (run as { id: string }).id } });
}
