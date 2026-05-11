import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PhoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\+\d{7,15}$/, "手机号须为 E.164 格式，如 +6591234567"),
});

const EmailSchema = z.object({
  email: z.string().email("请输入有效的电子邮件地址"),
  redirect_to: z.string().url().optional(),
});

const BodySchema = z.union([PhoneSchema, EmailSchema]);

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

  const parsed = BodySchema.safeParse(body);
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

  const supabase = await getSupabaseServerClient();

  if ("phone" in parsed.data) {
    const { error } = await supabase.auth.signInWithOtp({
      phone: parsed.data.phone,
    });

    if (error) {
      if (error.status === 429) {
        return NextResponse.json({
          ok: false,
          error: { code: "RATE_LIMITED", message: "发送过于频繁，请稍后再试", retryAfter: 60 },
        });
      }
      return NextResponse.json({
        ok: false,
        error: { code: "OTP_SEND_FAILED", message: error.message },
      });
    }

    return NextResponse.json({ ok: true, data: { method: "phone" } });
  } else {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const redirectTo = parsed.data.redirect_to ?? `${siteUrl}/api/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      return NextResponse.json({
        ok: false,
        error: { code: "MAGIC_LINK_FAILED", message: error.message },
      });
    }

    return NextResponse.json({ ok: true, data: { method: "email" } });
  }
}
