import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveProjectBySlug, insertDataFeedback } from "@/lib/condo/repo";

export const runtime = "nodejs";

const FeedbackSchema = z.object({
  slug: z.string().min(1),
  dimension: z.enum(["profit", "location", "exit", "rental"]).optional(),
  note: z.string().min(2).max(2000),
  contact: z.string().max(120).optional(),
});

/** Data-correction report (SPEC §7.2). POST /api/v1/condo/feedback */
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

  const parsed = FeedbackSchema.safeParse(body);
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

  const { slug, dimension, note, contact } = parsed.data;
  const db = await getSupabaseServerClient();

  const project = await getActiveProjectBySlug(db, slug);
  if (!project) {
    return NextResponse.json({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND", message: "未找到该楼盘" },
    });
  }

  try {
    await insertDataFeedback(db, {
      projectId: project.id,
      dimension: dimension ?? null,
      userNote: note,
      contact: contact ?? null,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: { code: "FEEDBACK_WRITE_FAILED", message: "反馈提交失败，请稍后再试" },
    });
  }

  return NextResponse.json({ ok: true, data: { received: true } });
}
